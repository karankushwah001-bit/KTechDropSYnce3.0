import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useServer } from '@/context/ServerContext';
import type { FileInfo } from '@/server/storage';

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'file-pdf-box', doc: 'file-word-box', docx: 'file-word-box',
    xls: 'file-excel-box', xlsx: 'file-excel-box',
    mp3: 'music-note', wav: 'music-note', flac: 'music-note',
    mp4: 'video-box', mov: 'video-box', avi: 'video-box', mkv: 'video-box',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
    zip: 'zip-box', rar: 'zip-box', '7z': 'zip-box',
    apk: 'android', txt: 'file-document-outline',
  };
  return map[ext] ?? 'file-outline';
}

function FileItem({ file, onDelete }: { file: FileInfo; onDelete: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.fileItem, { backgroundColor: colors.muted }]}>
      <View style={styles.fileIconBox}>
        <MaterialCommunityIcons name={getFileIcon(file.name) as any} size={22} color="#764ba2" />
      </View>
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={[styles.fileSize, { color: colors.mutedForeground }]}>
          {formatSize(file.size)}
        </Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <MaterialCommunityIcons name="trash-can-outline" size={19} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const server = useServer();
  const [isAdding, setIsAdding] = useState(false);
  const isDark = useColorScheme() === 'dark';
  const bottomPad = insets.bottom + 80;

  // Uses the system Document Picker (Storage Access Framework) — works for any
  // file type including ones on an SD card, no storage permission required.
  const handleAddDocuments = async () => {
    setIsAdding(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        for (const asset of result.assets) {
          await server.addFileToShare(asset.uri, asset.name ?? 'file');
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Document picker error:', e);
    } finally {
      setIsAdding(false);
    }
  };

  // Uses the system Photo Picker (Android 13+) / Media Library UI on older
  // versions — this shows the actual camera-roll gallery for fast selection
  // and, on Android 13+, needs no runtime permission at all.
  const handleAddFromGallery = async () => {
    setIsAdding(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
        exif: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        for (const asset of result.assets) {
          const name = asset.fileName ?? asset.uri.split('/').pop() ?? `media_${Date.now()}`;
          await server.addFileToShare(asset.uri, name);
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Gallery picker error:', e);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0f0a1e' : '#f5f3ff' }]}>
      <LinearGradient
        colors={['#4f46e5', '#667eea', '#764ba2']}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Text style={styles.headerTitle}>Files Explorer</Text>
        <Text style={styles.headerSub}>Manage Shared &amp; Uploaded Files</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sharing from Phone</Text>
          </View>

          <View style={styles.addButtonsRow}>
            <TouchableOpacity onPress={handleAddFromGallery} style={[styles.addBtn, { flex: 1 }]} disabled={isAdding}>
              <MaterialCommunityIcons name="image-multiple-outline" size={16} color="#fff" />
              <Text style={styles.addBtnText}>{isAdding ? 'Adding...' : 'Photos / Videos'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddDocuments} style={[styles.addBtn, styles.addBtnAlt, { flex: 1 }]} disabled={isAdding}>
              <MaterialCommunityIcons name="file-plus-outline" size={16} color="#fff" />
              <Text style={styles.addBtnText}>{isAdding ? 'Adding...' : 'Any File'}</Text>
            </TouchableOpacity>
          </View>

          {server.sharedFiles.length === 0 ? (
            <Text style={styles.emptyText}>No files shared from phone.</Text>
          ) : (
            server.sharedFiles.map(f => (
              <FileItem key={f.name} file={f} onDelete={() => server.removeSharedFile(f.name)} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>
            Received from Browser
          </Text>

          {server.uploadedFiles.length === 0 ? (
            <Text style={styles.emptyText}>No uploads received yet.</Text>
          ) : (
            server.uploadedFiles.map(f => (
              <FileItem key={f.name} file={f} onDelete={() => server.removeUploadedFile(f.name)} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  section: { margin: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  addButtonsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#667eea', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  addBtnAlt: { backgroundColor: '#764ba2' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fileItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 8 },
  fileIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '600' },
  fileSize: { fontSize: 11 },
  deleteBtn: { padding: 6 },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginVertical: 12 },
});
