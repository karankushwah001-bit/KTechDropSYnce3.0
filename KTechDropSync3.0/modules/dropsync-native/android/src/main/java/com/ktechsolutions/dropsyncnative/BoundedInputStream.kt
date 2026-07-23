package com.ktechsolutions.dropsyncnative

import java.io.InputStream
import java.io.RandomAccessFile

/**
 * Wraps a RandomAccessFile (already seeked to the desired start position) and
 * exposes it as a plain InputStream that stops after [length] bytes.
 *
 * Used to serve HTTP "Range" requests (e.g. "bytes=1000000-2000000") so that
 * large video/files can be resumed, scrubbed, or downloaded by download
 * managers without ever loading the whole file into memory.
 */
class BoundedInputStream(
    private val raf: RandomAccessFile,
    private var remaining: Long
) : InputStream() {

    override fun read(): Int {
        if (remaining <= 0) return -1
        val b = raf.read()
        if (b >= 0) remaining--
        return b
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (remaining <= 0) return -1
        val toRead = if (len.toLong() > remaining) remaining.toInt() else len
        val read = raf.read(b, off, toRead)
        if (read > 0) remaining -= read
        return read
    }

    override fun close() {
        raf.close()
    }
}
