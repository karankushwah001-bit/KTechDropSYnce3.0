package com.ktechsolutions.dropsyncnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import fi.iki.elonen.NanoHTTPD

/**
 * Why a Foreground Service is required (not just a JS-side "server running"
 * flag): Android aggressively suspends background work and can put the Wi-Fi
 * radio to sleep to save battery. Without a Foreground Service + WifiLock,
 * the socket listener can silently stop responding a few seconds after the
 * user leaves the app or the screen turns off — this was the root cause of
 * "QR opens but nothing connects" in Test 2 on some devices/timings.
 */
class DropSyncForegroundService : Service() {

    private var wifiLock: WifiManager.WifiLock? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelfCleanly()
                return START_NOT_STICKY
            }
            else -> {
                val port = intent?.getIntExtra(EXTRA_PORT, 5050) ?: 5050
                startForegroundInternal(port)
                return START_STICKY
            }
        }
    }

    private fun startForegroundInternal(port: Int) {
        createChannelIfNeeded()
        startForeground(NOTIFICATION_ID, buildNotification())
        acquireLocks()

        try {
            httpServer?.stop()
            val server = DropSyncHttpServer(applicationContext, port)
            server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            httpServer = server
            activePort = port
            isRunning = true
        } catch (e: Exception) {
            isRunning = false
            activePort = 0
        }
    }

    private fun acquireLocks() {
        try {
            val wm = applicationContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DropSync:WifiLock").apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (e: Exception) { /* best effort */ }

        try {
            val pm = applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DropSync:WakeLock").apply {
                setReferenceCounted(false)
                acquire(12 * 60 * 60 * 1000L) // 12h safety cap, refreshed each time server (re)starts
            }
        } catch (e: Exception) { /* best effort */ }
    }

    private fun releaseLocks() {
        try { wifiLock?.let { if (it.isHeld) it.release() } } catch (e: Exception) {}
        wifiLock = null
        try { wakeLock?.let { if (it.isHeld) it.release() } } catch (e: Exception) {}
        wakeLock = null
    }

    private fun stopSelfCleanly() {
        httpServer?.stop()
        httpServer = null
        isRunning = false
        activePort = 0
        releaseLocks()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    override fun onDestroy() {
        httpServer?.stop()
        httpServer = null
        isRunning = false
        activePort = 0
        releaseLocks()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(CHANNEL_ID, "DropSync Server", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Shown while the DropSync local server is active"
                    setShowBadge(false)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    private fun buildNotification(): Notification {
        val iconRes = applicationContext.applicationInfo.icon
        return NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("KTech DropSync is active")
            .setContentText("Local server running \u2014 ready to share files")
            .setSmallIcon(iconRes)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "dropsync_server_channel"
        const val NOTIFICATION_ID = 4201
        const val ACTION_START = "com.ktechsolutions.dropsyncnative.action.START"
        const val ACTION_STOP = "com.ktechsolutions.dropsyncnative.action.STOP"
        const val EXTRA_PORT = "port"

        // Plain public vars (not private-set): these are only ever mutated from
        // this Service's own instance methods and read by the Expo Module in the
        // same process, so keeping them simple avoids Kotlin companion-object
        // visibility edge cases while remaining perfectly safe for this use case.
        @Volatile
        var isRunning: Boolean = false

        @Volatile
        var activePort: Int = 0

        @Volatile
        var httpServer: DropSyncHttpServer? = null
    }
}
