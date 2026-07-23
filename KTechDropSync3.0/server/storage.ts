import * as FileSystem from 'expo-file-system/legacy';

export const SHARED_DIR = (FileSystem.documentDirectory ?? '') + 'dropsync/shared/';
export const UPLOADS_DIR = (FileSystem.documentDirectory ?? '') + 'dropsync/uploads/';

export interface FileInfo {
  name: string;
  size: number;
  modifiedAt: number;
}

export async function initStorageDirs(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(SHARED_DIR, { intermediates: true });
  } catch {}
  try {
    await FileSystem.makeDirectoryAsync(UPLOADS_DIR, { intermediates: true });
  } catch {}
}

export async function listFiles(dir: string): Promise<FileInfo[]> {
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    const infos = await Promise.all(
      names.map(async (name) => {
        try {
          const info = await FileSystem.getInfoAsync(dir + name);
          return {
            name,
            size: info.exists && !info.isDirectory && (info as any).size ? (info as any).size : 0,
            modifiedAt: info.exists && (info as any).modificationTime ? (info as any).modificationTime * 1000 : Date.now(),
          };
        } catch {
          return { name, size: 0, modifiedAt: Date.now() };
        }
      })
    );
    return infos.filter((f) => !f.name.startsWith('.'));
  } catch {
    return [];
  }
}