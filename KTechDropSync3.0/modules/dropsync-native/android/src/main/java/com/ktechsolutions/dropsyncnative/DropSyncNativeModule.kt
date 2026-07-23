package com.ktechsolutions.dropsyncnative

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DropSyncNativeModule : Module() {

    private val context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    override fun definition() = ModuleDefinition {
        Name("DropSyncNative")

        AsyncFunction("startServer") { port: Int, promise: expo.modules.kotlin.Promise ->
            try {
                val intent = Intent(context, DropSyncForegroundService::class.java).apply {
                    action = DropSyncForegroundService.ACTION_START
                    putExtra(DropSyncForegroundService.EXTRA_PORT, port)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }

                // Wait briefly for the service to actually bind the socket before
                // resolving, so the JS side gets a true/false answer instead of an
                // optimistic guess.
                CoroutineScope(Dispatchers.Default).launch {
                    var waited = 0
                    while (!DropSyncForegroundService.isRunning && waited < 5000) {
                        delay(100)
                        waited += 100
                    }
                    withContext(Dispatchers.Main) {
                        if (DropSyncForegroundService.isRunning) {
                            promise.resolve(DropSyncForegroundService.activePort)
                        } else {
                            promise.reject("ERR_SERVER_START", "Server did not start within 5s", null)
                        }
                    }
                }
            } catch (e: Exception) {
                promise.reject("ERR_SERVER_START", e.message ?: "Unknown error starting server", e)
            }
        }

        Function("stopServer") {
            val intent = Intent(context, DropSyncForegroundService::class.java).apply {
                action = DropSyncForegroundService.ACTION_STOP
            }
            context.startService(intent)
            true
        }

        Function("getServerStatus") {
            mapOf(
                "isRunning" to DropSyncForegroundService.isRunning,
                "port" to DropSyncForegroundService.activePort
            )
        }

        AsyncFunction("getLocalIpAddresses") { promise: expo.modules.kotlin.Promise ->
            CoroutineScope(Dispatchers.IO).launch {
                val list = NetworkUtils.getLocalIPv4Addresses().map {
                    mapOf(
                        "interfaceName" to it.interfaceName,
                        "address" to it.address,
                        "isLikelyHotspot" to it.isLikelyHotspot
                    )
                }
                withContext(Dispatchers.Main) { promise.resolve(list) }
            }
        }

        Function("getTexts") {
            DropSyncForegroundService.httpServer?.getTextsAsMapList() ?: emptyList<Map<String, Any>>()
        }

        Function("addPhoneText") { text: String ->
            DropSyncForegroundService.httpServer?.addPhoneText(text)
            true
        }

        Function("removeText") { id: String ->
            DropSyncForegroundService.httpServer?.removeText(id)
            true
        }

        Function("getActivities") {
            DropSyncForegroundService.httpServer?.getActivityAsMapList() ?: emptyList<Map<String, Any?>>()
        }
    }
}
