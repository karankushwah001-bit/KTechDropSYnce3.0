import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useColors } from '@/hooks/useColors';
import { useServer } from '@/context/ServerContext';
import { isDropSyncNativeAvailable } from '@/modules/dropsync-native';

export default function ServerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const server = useServer();
  const isDark = useColorScheme() === 'dark';
  const [showAlternates, setShowAlternates] = useState(false);

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const qrFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (server.isRunning) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
            Animated.timing(pulseScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          ]),
        ])
      );
      pulse.start();
      Animated.timing(qrFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      return () => pulse.stop();
    } else {
      Animated.timing(qrFade, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [server.isRunning]);

  const handleToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (server.isRunning) {
      server.stopServerAction();
    } else {
      await server.startServerAction();
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const serverUrl = server.ip ? `http://${server.ip}:${server.port}` : '';
  const bottomPad = insets.bottom + 80;
  const otherAddresses = server.alternateAddresses.filter((a) => a.address !== server.ip);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0f0a1e' : '#f5f3ff' }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <LinearGradient
          colors={['#4f46e5', '#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 24 }]}
        >
          <MaterialCommunityIcons name="rocket-launch" size={44} color="rgba(255,255,255,0.95)" />
          <Text style={styles.headerTitle}>KTech DropSync</Text>
          <Text style={styles.headerEdition}>Elite Edition v3.1 (Native Server)</Text>
          <Text style={styles.headerTagline}>Solutions by Innovations</Text>
        </LinearGradient>

        {!isDropSyncNativeAvailable && (
          <View style={[styles.card, styles.warnCard, { backgroundColor: isDark ? '#1c1306' : '#fffbeb' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#f59e0b" />
            <Text style={styles.warnText}>
              Native DropSync server not found. This happens in Expo Go. Build and install a real
              development build or APK (via EAS / GitHub Actions) to use the server.
            </Text>
          </View>
        )}

        <View style={[styles.card, styles.controlCard, { backgroundColor: colors.card }]}>
          <View style={styles.btnOuter}>
            {server.isRunning && (
              <Animated.View
                style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
              />
            )}
            <Pressable
              onPress={handleToggle}
              disabled={server.isStarting}
              style={({ pressed }) => [pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] }]}
            >
              <LinearGradient
                colors={server.isRunning ? ['#16a34a', '#22c55e'] : ['#4f46e5', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.toggleBtn}
              >
                <MaterialCommunityIcons
                  name={server.isStarting ? 'loading' : server.isRunning ? 'stop' : 'play'}
                  size={52}
                  color="white"
                />
              </LinearGradient>
            </Pressable>
          </View>

          <Text style={[styles.statusLabel, { color: server.isRunning ? '#22c55e' : colors.mutedForeground }]}>
            {server.isStarting
              ? 'Starting Server...'
              : server.isRunning
              ? 'DropSync Server Active'
              : 'Tap to Start Server'}
          </Text>

          {server.isRunning && server.ip && (
            <View style={styles.addressChip}>
              <MaterialCommunityIcons name="wifi" size={14} color="#667eea" />
              <Text style={styles.addressText}>{server.ip}:{server.port}</Text>
            </View>
          )}

          {!!server.error && <Text style={styles.errorText}>{server.error}</Text>}
        </View>

        {server.isRunning && !!serverUrl && (
          <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: qrFade }]}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="qrcode-scan" size={20} color="#667eea" />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Scan to Connect</Text>
            </View>
            <Text style={[styles.bodyText, { color: colors.mutedForeground, marginBottom: 16 }]}>
              Open on any device connected to the same Wi-Fi router or this phone&apos;s Hotspot
            </Text>
            <View style={styles.qrWrapper}>
              <QRCode value={serverUrl} size={188} color="#4f46e5" backgroundColor="#ffffff" />
            </View>
            <Pressable onPress={() => handleCopy(serverUrl)} style={[styles.urlChip, { backgroundColor: colors.muted }]}>
              <MaterialCommunityIcons name="link-variant" size={14} color="#764ba2" />
              <Text style={[styles.urlText, { color: colors.secondary }]} numberOfLines={1}>{serverUrl}</Text>
              <MaterialCommunityIcons name="content-copy" size={14} color="#764ba2" />
            </Pressable>

            {otherAddresses.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Pressable onPress={() => setShowAlternates((v) => !v)} style={styles.alternatesToggle}>
                  <Text style={[styles.alternatesToggleText, { color: colors.mutedForeground }]}>
                    {showAlternates ? 'Hide' : 'Not connecting? Show'} other addresses found on this phone ({otherAddresses.length})
                  </Text>
                  <MaterialCommunityIcons
                    name={showAlternates ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {showAlternates &&
                  otherAddresses.map((addr) => {
                    const url = `http://${addr.address}:${server.port}`;
                    return (
                      <Pressable
                        key={addr.address}
                        onPress={() => handleCopy(url)}
                        style={[styles.urlChip, { backgroundColor: colors.muted, marginTop: 6 }]}
                      >
                        <MaterialCommunityIcons
                          name={addr.isLikelyHotspot ? 'access-point' : 'router-wireless'}
                          size={14}
                          color="#764ba2"
                        />
                        <Text style={[styles.urlText, { color: colors.secondary }]} numberOfLines={1}>
                          {url} ({addr.interfaceName}{addr.isLikelyHotspot ? ', hotspot' : ''})
                        </Text>
                        <MaterialCommunityIcons name="content-copy" size={14} color="#764ba2" />
                      </Pressable>
                    );
                  })}
              </View>
            )}
          </Animated.View>
        )}

        {!server.isRunning && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#667eea" />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>How It Works</Text>
            </View>
            {[
              { icon: 'wifi', text: 'Connect both devices to the same WiFi router, or turn on this phone\'s Hotspot and connect the other device to it' },
              { icon: 'play-circle-outline', text: 'Tap Start — this phone becomes a local file server (runs as a foreground service, so it keeps working even if the screen turns off)' },
              { icon: 'qrcode-scan', text: 'Scan the QR code, or if it doesn\'t connect, try one of the alternate addresses shown below the main one' },
              { icon: 'swap-horizontal', text: 'Upload, download, and share text between devices — any file type, any size, one at a time or in bulk' },
            ].map((item, i) => (
              <View key={i} style={styles.howRow}>
                <View style={styles.howIcon}>
                  <MaterialCommunityIcons name={item.icon as any} size={17} color="#667eea" />
                </View>
                <Text style={[styles.howText, { color: colors.foreground }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 27, fontWeight: '800', marginTop: 10 },
  headerEdition: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  headerTagline: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  card: { borderRadius: 16, padding: 20, margin: 16, marginBottom: 0 },
  warnCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warnText: { flex: 1, color: '#92400e', fontSize: 13, lineHeight: 18 },
  controlCard: { alignItems: 'center', paddingVertical: 30 },
  btnOuter: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 18, width: 120, height: 120 },
  pulseRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#22c55e44' },
  toggleBtn: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  addressChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f3f0ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
  addressText: { color: '#667eea', fontSize: 13, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 10, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  bodyText: { fontSize: 13, lineHeight: 18 },
  qrWrapper: { alignItems: 'center', padding: 18, backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e9e0ff' },
  urlChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  urlText: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  alternatesToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  alternatesToggleText: { fontSize: 12, fontWeight: '600', flex: 1 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  howIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f0ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
