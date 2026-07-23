package com.ktechsolutions.dropsyncnative

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.RandomAccessFile
import java.net.URLDecoder
import java.util.Collections
import kotlin.random.Random

/**
 * Runs entirely in native Android code (no JS bridge involved in the data
 * path), which is why it survives backgrounding / New Architecture / large
 * file transfers far more reliably than the old react-native-tcp-socket
 * based server did.
 *
 * Data directories intentionally use the exact same paths as
 * `expo-file-system`'s documentDirectory (context.filesDir) so the existing
 * JS-side file picker / storage.ts code keeps working unchanged — both
 * sides are just reading/writing the same folder on disk.
 */
class DropSyncHttpServer(
    private val appContext: Context,
    port: Int
) : NanoHTTPD(port) {

    val sharedDir: File = File(appContext.filesDir, "dropsync/shared").apply { mkdirs() }
    val uploadsDir: File = File(appContext.filesDir, "dropsync/uploads").apply { mkdirs() }

    data class TextEntry(val id: String, val text: String, val source: String, val timestamp: Long)
    data class ActivityEntry(
        val type: String,
        val filename: String?,
        val size: Long?,
        val text: String?,
        val timestamp: Long
    )

    private val texts = Collections.synchronizedList(mutableListOf<TextEntry>())
    private val activityLog = Collections.synchronizedList(mutableListOf<ActivityEntry>())

    // ---------- Public API used by the Expo Module (JS <-> Kotlin bridge) ----------

    fun addPhoneText(text: String) {
        if (text.isBlank()) return
        texts.add(0, TextEntry(uid(), text.trim(), "phone", System.currentTimeMillis()))
        while (texts.size > 20) texts.removeAt(texts.size - 1)
    }

    fun removeText(id: String) {
        synchronized(texts) { texts.removeAll { it.id == id } }
    }

    fun getTextsAsMapList(): List<Map<String, Any>> = synchronized(texts) {
        texts.map { mapOf("id" to it.id, "text" to it.text, "source" to it.source, "timestamp" to it.timestamp) }
    }

    fun getActivityAsMapList(): List<Map<String, Any?>> = synchronized(activityLog) {
        activityLog.take(50).map {
            mapOf("type" to it.type, "filename" to it.filename, "size" to it.size, "text" to it.text, "timestamp" to it.timestamp)
        }
    }

    // ---------- HTTP routing ----------

    override fun serve(session: IHTTPSession): Response {
        val response = try {
            when {
                session.method == Method.OPTIONS -> newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, "")
                session.uri == "/" && session.method == Method.GET -> serveWebUi()
                session.uri == "/api/status" && session.method == Method.GET ->
                    jsonResponse(JSONObject().put("status", "running").put("version", "3.1 Elite Native").toString())
                session.uri == "/api/files/shared" && session.method == Method.GET -> jsonResponse(filesJson(sharedDir))
                session.uri == "/api/files/uploaded" && session.method == Method.GET -> jsonResponse(filesJson(uploadsDir))
                session.uri.startsWith("/api/download/") && session.method == Method.GET -> handleDownload(session)
                session.uri == "/api/upload" && session.method == Method.POST -> handleUpload(session)
                session.uri.startsWith("/api/delete/") && session.method == Method.POST -> handleDelete(session)
                session.uri == "/api/text" && session.method == Method.POST -> handleTextPost(session)
                session.uri == "/api/texts" && session.method == Method.GET -> jsonResponse(textsJson())
                session.uri == "/api/activity" && session.method == Method.GET -> jsonResponse(activityJson())
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found")
            }
        } catch (e: Exception) {
            jsonResponse(JSONObject().put("status", "error").put("message", (e.message ?: "error")).toString(), Response.Status.INTERNAL_ERROR)
        }
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Range")
        return response
    }

    // ---------- Route handlers ----------

    private fun serveWebUi(): Response {
        return try {
            val stream = appContext.assets.open("dropsync_web/index.html")
            newChunkedResponse(Response.Status.OK, "text/html; charset=utf-8", stream)
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Web UI asset missing: ${e.message}")
        }
    }

    private fun handleUpload(session: IHTTPSession): Response {
        val files = HashMap<String, String>()
        try {
            session.parseBody(files)
        } catch (e: Exception) {
            return jsonResponse(JSONObject().put("status", "error").put("message", e.message ?: "parse error").toString(), Response.Status.BAD_REQUEST)
        }

        val params = session.parameters
        val uploadedNames = mutableListOf<String>()

        for ((fieldName, tempPath) in files) {
            // NanoHTTPD stores the ORIGINAL client-provided filename as the
            // form parameter value for the same field name (a well known
            // quirk of its multipart parser), with the actual bytes written
            // to a temp file already — so uploads never load fully into
            // memory, which is what makes "any size" file uploads work.
            val originalName = params[fieldName]?.firstOrNull()?.takeIf { it.isNotBlank() }
                ?: "file_${System.currentTimeMillis()}"
            val safeName = sanitizeFileName(originalName)
            val tempFile = File(tempPath)
            if (!tempFile.exists() || tempFile.length() == 0L) continue

            val destFile = uniqueDestination(uploadsDir, safeName)
            try {
                if (!tempFile.renameTo(destFile)) {
                    tempFile.copyTo(destFile, overwrite = true)
                    tempFile.delete()
                }
                uploadedNames.add(destFile.name)
                activityLog.add(0, ActivityEntry("upload", destFile.name, destFile.length(), null, System.currentTimeMillis()))
            } catch (e: Exception) {
                // Skip this file, continue with others
            }
        }
        trimActivity()

        val arr = JSONArray()
        uploadedNames.forEach { arr.put(it) }
        return jsonResponse(JSONObject().put("status", "success").put("uploaded", arr).toString())
    }

    private fun handleDownload(session: IHTTPSession): Response {
        val parts = session.uri.removePrefix("/api/download/").split("/")
        if (parts.size < 2) return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found")

        val type = parts[0]
        val filename = URLDecoder.decode(parts.drop(1).joinToString("/"), "UTF-8")
        val dir = if (type == "shared") sharedDir else uploadsDir
        val file = File(dir, filename)

        if (!file.exists() || file.isDirectory) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "File not found")
        }

        val mime = mimeTypeFor(file.name)
        val fileLen = file.length()
        val rangeHeader = session.headers["range"]

        val response: Response
        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            val rangeSpec = rangeHeader.removePrefix("bytes=")
            val dashIdx = rangeSpec.indexOf('-')
            val startStr = if (dashIdx >= 0) rangeSpec.substring(0, dashIdx) else rangeSpec
            val endStr = if (dashIdx >= 0 && dashIdx < rangeSpec.length - 1) rangeSpec.substring(dashIdx + 1) else ""
            val start = startStr.toLongOrNull() ?: 0L
            val end = (endStr.toLongOrNull() ?: (fileLen - 1)).coerceAtMost(fileLen - 1)
            val length = (end - start + 1).coerceAtLeast(0)

            val raf = RandomAccessFile(file, "r")
            raf.seek(start)
            val bounded = BoundedInputStream(raf, length)
            response = newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mime, bounded, length)
            response.addHeader("Content-Range", "bytes $start-$end/$fileLen")
        } else {
            val stream = FileInputStream(file)
            response = newFixedLengthResponse(Response.Status.OK, mime, stream, fileLen)
        }

        response.addHeader("Accept-Ranges", "bytes")
        response.addHeader("Content-Disposition", "attachment; filename=\"${file.name}\"")

        activityLog.add(0, ActivityEntry("download", file.name, fileLen, null, System.currentTimeMillis()))
        trimActivity()
        return response
    }

    private fun handleDelete(session: IHTTPSession): Response {
        val parts = session.uri.removePrefix("/api/delete/").split("/")
        if (parts.size < 2) return jsonResponse(JSONObject().put("status", "not found").toString())
        val type = parts[0]
        val filename = URLDecoder.decode(parts.drop(1).joinToString("/"), "UTF-8")
        val dir = if (type == "shared") sharedDir else uploadsDir
        val file = File(dir, filename)
        return if (file.exists() && file.delete()) {
            jsonResponse(JSONObject().put("status", "deleted").toString())
        } else {
            jsonResponse(JSONObject().put("status", "not found").toString())
        }
    }

    private fun handleTextPost(session: IHTTPSession): Response {
        val files = HashMap<String, String>()
        try {
            session.parseBody(files) // also populates session.parameters for urlencoded/multipart form fields
        } catch (e: Exception) {
            // ignore, fall through with empty parameters
        }
        val text = session.parameters["text"]?.firstOrNull()?.trim().orEmpty()
        if (text.isNotEmpty()) {
            texts.add(0, TextEntry(uid(), text, "browser", System.currentTimeMillis()))
            while (texts.size > 20) texts.removeAt(texts.size - 1)
            activityLog.add(0, ActivityEntry("text", null, null, text.take(60), System.currentTimeMillis()))
            trimActivity()
        }
        return jsonResponse(JSONObject().put("status", "received").toString())
    }

    // ---------- JSON helpers ----------

    private fun filesJson(dir: File): String {
        val arr = JSONArray()
        dir.listFiles()?.filter { it.isFile && !it.name.startsWith(".") }?.sortedByDescending { it.lastModified() }?.forEach { f ->
            arr.put(
                JSONObject()
                    .put("name", f.name)
                    .put("size", f.length())
                    .put("modifiedAt", f.lastModified())
                    .put("mimeType", mimeTypeFor(f.name))
                    .put("category", categoryFor(f.name))
            )
        }
        return JSONObject().put("files", arr).toString()
    }

    private fun textsJson(): String {
        val arr = JSONArray()
        synchronized(texts) {
            texts.forEach { arr.put(JSONObject().put("id", it.id).put("text", it.text).put("source", it.source).put("timestamp", it.timestamp)) }
        }
        return JSONObject().put("texts", arr).toString()
    }

    private fun activityJson(): String {
        val arr = JSONArray()
        synchronized(activityLog) {
            activityLog.take(50).forEach {
                arr.put(
                    JSONObject()
                        .put("type", it.type)
                        .put("filename", it.filename)
                        .put("size", it.size)
                        .put("text", it.text)
                        .put("timestamp", it.timestamp)
                )
            }
        }
        return JSONObject().put("activity", arr).toString()
    }

    private fun jsonResponse(json: String, status: Response.Status = Response.Status.OK): Response =
        newFixedLengthResponse(status, "application/json", json)

    private fun trimActivity() {
        while (activityLog.size > 50) activityLog.removeAt(activityLog.size - 1)
    }

    private fun uid(): String =
        System.currentTimeMillis().toString(36) + Random.nextInt(0, 999999).toString(36)

    private fun sanitizeFileName(name: String): String {
        val base = name.substringAfterLast('/').substringAfterLast('\\')
        return base.replace(Regex("[\\x00-\\x1f]"), "").ifBlank { "file_${System.currentTimeMillis()}" }
    }

    private fun uniqueDestination(dir: File, name: String): File {
        var candidate = File(dir, name)
        if (!candidate.exists()) return candidate
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var i = 1
        while (candidate.exists()) {
            candidate = File(dir, "$base ($i)$ext")
            i++
        }
        return candidate
    }

    companion object {
        private val MIME_MAP = mapOf(
            "html" to "text/html; charset=utf-8", "css" to "text/css", "js" to "text/javascript",
            "json" to "application/json", "txt" to "text/plain; charset=utf-8", "pdf" to "application/pdf",
            "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "gif" to "image/gif",
            "webp" to "image/webp", "svg" to "image/svg+xml", "heic" to "image/heic",
            "mp4" to "video/mp4", "mov" to "video/quicktime", "mkv" to "video/x-matroska", "webm" to "video/webm",
            "3gp" to "video/3gpp", "mp3" to "audio/mpeg", "wav" to "audio/wav", "m4a" to "audio/mp4",
            "flac" to "audio/flac", "ogg" to "audio/ogg", "zip" to "application/zip", "rar" to "application/x-rar-compressed",
            "7z" to "application/x-7z-compressed", "apk" to "application/vnd.android.package-archive",
            "doc" to "application/msword", "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls" to "application/vnd.ms-excel", "xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt" to "application/vnd.ms-powerpoint", "pptx" to "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )

        fun mimeTypeFor(filename: String): String {
            val ext = filename.substringAfterLast('.', "").lowercase()
            return MIME_MAP[ext] ?: "application/octet-stream"
        }

        fun categoryFor(filename: String): String {
            val ext = filename.substringAfterLast('.', "").lowercase()
            return when (ext) {
                "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic" -> "image"
                "mp4", "mkv", "mov", "avi", "webm", "3gp" -> "video"
                "mp3", "wav", "aac", "flac", "ogg", "m4a" -> "audio"
                "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt" -> "document"
                else -> "other"
            }
        }
    }
}
