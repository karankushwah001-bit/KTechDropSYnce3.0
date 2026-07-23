package com.ktechsolutions.dropsyncnative

import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * Why this exists:
 * `expo-network`'s getIpAddressAsync() only reads the Wi-Fi *client* (station)
 * IP via WifiManager. When the phone is acting as its own Hotspot (Access
 * Point), it is NOT a Wi-Fi client, so that API returns nothing useful and
 * the app falls back to a hardcoded/guessed address (this was Test 1's bug).
 *
 * This scans ALL real network interfaces directly (like `ifconfig`/`ip addr`
 * would) so it works correctly whether the phone is:
 *  - connected to a router as a client (Test 2 scenario)
 *  - hosting its own Hotspot (Test 1 scenario)
 *  - both, or has multiple usable interfaces
 *
 * We return every plausible candidate instead of guessing a single "right"
 * answer, because OEMs name their hotspot interface differently
 * (ap0, wlan1, swlan0, softap0 ...). The UI shows the best guess first and
 * lets the user fall back to another address if needed — this makes IP
 * discovery robust instead of fragile.
 */
object NetworkUtils {

    data class LocalAddress(
        val interfaceName: String,
        val address: String,
        val isLikelyHotspot: Boolean
    )

    private val HOTSPOT_IP_PREFIXES = listOf(
        "192.168.43.", "192.168.42.", "192.168.49.",
        "192.168.223.", "192.168.137.", "192.168.220."
    )

    private val RELEVANT_INTERFACE_HINTS = listOf(
        "wlan", "ap", "swlan", "softap", "eth", "wifi"
    )

    private val IGNORED_INTERFACE_HINTS = listOf(
        "rmnet", "ccmni", "usb", "p2p", "dummy", "lo", "radio"
    )

    fun getLocalIPv4Addresses(): List<LocalAddress> {
        val result = mutableListOf<LocalAddress>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return result
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                val name = iface.name?.lowercase() ?: continue

                if (!iface.isUp || iface.isLoopback) continue
                if (IGNORED_INTERFACE_HINTS.any { name.contains(it) }) continue

                val addresses = iface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (addr !is Inet4Address) continue
                    if (addr.isLoopbackAddress || addr.isLinkLocalAddress) continue

                    val ip = addr.hostAddress ?: continue
                    val looksRelevant = RELEVANT_INTERFACE_HINTS.any { name.contains(it) } ||
                        HOTSPOT_IP_PREFIXES.any { ip.startsWith(it) }

                    if (!looksRelevant) continue

                    val isHotspot = HOTSPOT_IP_PREFIXES.any { ip.startsWith(it) } ||
                        name.contains("ap") || name.contains("swlan") || name.contains("softap")

                    result.add(LocalAddress(iface.name, ip, isHotspot))
                }
            }
        } catch (e: Exception) {
            // Best-effort — an empty list just means the UI shows "no address found yet"
        }

        // Prefer a plain "wlan0" style station IP first (most universal / router case),
        // then hotspot-flagged addresses, then anything else found.
        return result.sortedWith(
            compareBy(
                { !it.interfaceName.lowercase().startsWith("wlan0") },
                { !it.isLikelyHotspot }
            )
        )
    }
}
