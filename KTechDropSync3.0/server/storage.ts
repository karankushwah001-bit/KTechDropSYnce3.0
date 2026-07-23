import * as FileSystem from 'expo-file-system/legacy';

export const SHARED_DIR = (FileSystem.documentDirectory ?? '') + 'dropsync/shared/';
export const UPLOADS_DIR = (FileSystem.documentDirectory ?? '') + 'dropsync/uploads/';

export interface FileInfo {
  name: string;
  size: number;
  modifiedAt: number;
  mimeType: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
}

export function detectCategory(filename: string): FileInfo['category'] {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'mov', 'avi', 'webm', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return 'document';
  return 'other';
}

export const MIME_MAP: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  zip: 'application/zip',
  apk: 'application/vnd.android.package-archive',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

export async function initStorageDirs(): Promise<void> {
  await FileSystem.makeDirectoryAsync(SHARED_DIR, { intermediates: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(UPLOADS_DIR, { intermediates: true }).catch(() => {});
}

export async function listFiles(dir: string): Promise<FileInfo[]> {
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    const infos = await Promise.all(
      names.map(async (name) => {
        try {
          const info = await FileSystem.getInfoAsync(dir + name);
          const size = info.exists && !info.isDirectory && (info as any).size ? (info as any).size : 0;
          const modifiedAt = info.exists && (info as any).modificationTime ? (info as any).modificationTime * 1000 : Date.now();
          return {
            name,
            size,
            modifiedAt,
            mimeType: getMimeType(name),
            category: detectCategory(name),
          };
        } catch {
          return {
            name,
            size: 0,
            modifiedAt: Date.now(),
            mimeType: getMimeType(name),
            category: detectCategory(name),
          };
        }
      })
    );
    return infos.filter((f) => !f.name.startsWith('.'));
  } catch {
    return [];
  }
}
