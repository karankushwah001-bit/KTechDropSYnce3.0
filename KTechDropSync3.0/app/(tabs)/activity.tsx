import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useServer } from '@/context/ServerContext';
import type { ActivityItem, TextEntry } from '@/server';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}

function activityMeta(item: ActivityItem): { icon: string; color: string; label: string } {
  if (item.type === 'upload') return { icon: 'cloud-upload-outline', color: '#22c55e', label: 'Uploaded' };
  if (item.type === 'download') return { icon: 'cloud-download-outline', color: '#3b82f6', label: 'Downloaded' };
  return { icon: 'chat-outline', color: '#764ba2', label: 'Text shared' };
}

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const server = useServer();
  const [textInput, setTextInput] = useState('');
  const isDark = useColorScheme() === 'dark';
  const bottomPad = insets.bottom + 65;

  const handleSend = () => {
    const t = textInput.trim();
    if (!t) return;
    server.sendText(t);
    setTextInput('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0f0a1e' : '#f5f3ff' }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={['#4f46e5', '#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Text style={styles.headerTitle}>Activity</Text>
        <Text style={styles.headerSub}>Text exchange & transfer history</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Text Exchange ── */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="chat-processing-outline" size={18} color="#667eea" />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Text Exchange</Text>
            </View>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Send text to the browser, or receive text typed on any connected device
            </Text>

            {/* Input */}
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={textInput}
                onChangeText={setTextInput}
                placeholder="Type text to send to browser..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendBtn, !textInput.trim() && { opacity: 0.45 }]}
                activeOpacity={0.8}
                disabled={!textInput.trim()}
              >
                <MaterialCommunityIcons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Texts list */}
            {server.texts.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="chat-outline" size={36} color="#c4b5fd" />
                <Text style={styles.emptyText}>
                  No texts yet. Send text above or type in the browser on another device.
                </Text>
              </View>
            ) : (
              server.texts.map(t => (
                <View
                  key={t.id}
                  style={[
                    styles.textItem,
                    { backgroundColor: colors.card },
                    t.source === 'browser' && styles.textItemBrowser,
                  ]}
                >
                  <View style={styles.textMeta}>
                    <View
                      style={[
                        styles.sourceBadge,
                        { backgroundColor: t.source === 'browser' ? '#3b82f6' : '#667eea' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={t.source === 'browser' ? 'web' : 'cellphone'}
                        size={11}
                        color="white"
                      />
                      <Text style={styles.sourceBadgeText}>
                        {t.source === 'browser' ? 'Browser' : 'Phone'}
                      </Text>
                    </View>
                    <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                      {formatTime(t.timestamp)}
                    </Text>
                    <View style={styles.textActions}>
                      <TouchableOpacity
                        onPress={() => handleCopy(t.text)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="content-copy" size={16} color="#667eea" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => server.deleteText(t.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.textContent, { color: colors.foreground }]}>{t.text}</Text>
                </View>
              ))
            )}
          </View>

          {/* ── Transfer History ── */}
          <View style={styles.section}>
            <View style={[styles.sectionTitleRow, { justifyContent: 'space-between' }]}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="history" size={18} color="#667eea" />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Transfer History
                </Text>
              </View>
              {server.activities.length > 0 && (
                <TouchableOpacity onPress={server.refreshTextsAndActivities} activeOpacity={0.7}>
                  <Text style={styles.clearText}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>

            {server.activities.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="swap-horizontal" size={36} color="#c4b5fd" />
                <Text style={styles.emptyText}>
                  No transfers yet. Start the server and share files or text!
                </Text>
              </View>
            ) : (
              server.activities.map(a => {
                const meta = activityMeta(a);
                return (
                  <View key={a.id} style={[styles.activityItem, { backgroundColor: colors.card }]}>
                    <View style={[styles.activityIcon, { backgroundColor: meta.color + '22' }]}>
                      <MaterialCommunityIcons name={meta.icon as any} size={19} color={meta.color} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityName, { color: colors.foreground }]} numberOfLines={1}>
                        {a.type === 'text' ? (a.text ?? 'Text shared') : (a.filename ?? 'Unknown file')}
                      </Text>
                      <Text style={[styles.activityMeta, { color: colors.mutedForeground }]}>
                        {meta.label}
                        {a.size ? ` · ${formatSize(a.size)}` : ''}
                        {' · '}
                        {formatTime(a.timestamp)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  section: { margin: 16, marginBottom: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionDesc: { fontSize: 12.5, lineHeight: 17, marginBottom: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  textInput: { flex: 1, fontSize: 14, maxHeight: 100, minHeight: 40 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  textItemBrowser: { borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  textMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  timeText: { fontSize: 11, flex: 1 },
  textActions: { flexDirection: 'row', gap: 10 },
  textContent: { fontSize: 14, lineHeight: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  clearText: { color: '#667eea', fontSize: 13, fontWeight: '600' },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityInfo: { flex: 1, minWidth: 0 },
  activityName: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  activityMeta: { fontSize: 11.5 },
});
