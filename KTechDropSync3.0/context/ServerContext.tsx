import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import DropSyncNative, { LocalAddress, NativeTextEntry, NativeActivityEntry } from '@/modules/dropsync-native';
import { listFiles, initStorageDirs, FileInfo, SHARED_DIR, UPLOADS_DIR } from '@/server/storage';

export const SERVER_PORT = 5050;

export interface TextEntry {
  id: string;
  text: string;
  source: 'phone' | 'browser';
  timestamp: number;
}

export interface ActivityItem {
  id: string;
  type: 'upload' | 'download' | 'text';
  filename?: string;
  size?: number;
  text?: string;
  timestamp: number;
}

export interface ServerState {
  isRunning: boolean;
  ip: string | null;
  alternateAddresses: LocalAddress[];
  port: number;
  sharedFiles: FileInfo[];
  uploadedFiles: FileInfo[];
  texts: TextEntry[];
  activities: ActivityItem[];
  isStarting: boolean;
  error: string | null;
}

interface ServerContextType extends ServerState {
  startServerAction: () => Promise<void>;
  stopServerAction: () => void;
  refreshFiles: () => Promise<void>;
  addFileToShare: (uri: string, name: string) => Promise<void>;
  removeSharedFile: (name: string) => Promise<void>;
  removeUploadedFile: (name: string) => Promise<void>;
  sendText: (text: string) => void;
  deleteText: (id: string) => void;
  refreshTextsAndActivities: () => void;
}

const ServerContext = createContext<ServerContextType | null>(null);

function mapText(t: NativeTextEntry): TextEntry {
  return { id: t.id, text: t.text, source: t.source, timestamp: t.timestamp };
}

function mapActivity(a: NativeActivityEntry, idx: number): ActivityItem {
  return {
    id: `${a.timestamp}_${idx}`,
    type: a.type,
    filename: a.filename,
    size: a.size,
    text: a.text,
    timestamp: a.timestamp,
  };
}

async function ensureNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    await PermissionsAndroid.request(
      // POST_NOTIFICATIONS constant is only present on RN builds targeting API 33+;
      // fall back to the raw string so this compiles regardless of RN version.
      (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS ?? 'android.permission.POST_NOTIFICATIONS'
    );
  } catch {
    // Non-fatal — the foreground notification will simply not be visible on some devices.
  }
}

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ServerState>({
    isRunning: false,
    ip: null,
    alternateAddresses: [],
    port: SERVER_PORT,
    sharedFiles: [],
    uploadedFiles: [],
    texts: [],
    activities: [],
    isStarting: false,
    error: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshFiles = useCallback(async () => {
    await initStorageDirs();
    const [shared, uploaded] = await Promise.all([listFiles(SHARED_DIR), listFiles(UPLOADS_DIR)]);
    setState((prev) => ({ ...prev, sharedFiles: shared, uploadedFiles: uploaded }));
  }, []);

  const refreshTextsAndActivities = useCallback(() => {
    const texts = DropSyncNative.getTexts().map(mapText);
    const activities = DropSyncNative.getActivities().map(mapActivity);
    setState((prev) => ({ ...prev, texts, activities }));
  }, []);

  const refreshAll = useCallback(async () => {
    await refreshFiles();
    refreshTextsAndActivities();
  }, [refreshFiles, refreshTextsAndActivities]);

  useEffect(() => {
    initStorageDirs().then(() => refreshFiles());
  }, [refreshFiles]);

  useEffect(() => {
    if (state.isRunning) {
      pollRef.current = setInterval(refreshAll, 2000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.isRunning, refreshAll]);

  const startServerAction = useCallback(async () => {
    setState((prev) => ({ ...prev, isStarting: true, error: null }));
    try {
      await ensureNotificationPermission();
      await DropSyncNative.startServer(SERVER_PORT);

      const addresses = await DropSyncNative.getLocalIpAddresses();
      const primary = addresses[0]?.address ?? null;

      setState((prev) => ({
        ...prev,
        isRunning: true,
        ip: primary,
        alternateAddresses: addresses,
        isStarting: false,
        error: primary
          ? null
          : 'Server started but no LAN address was found yet. Make sure Wi-Fi/Hotspot is on, then pull to refresh.',
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        isStarting: false,
        error: err?.message ?? 'Failed to start server',
      }));
    }
  }, []);

  const stopServerAction = useCallback(() => {
    DropSyncNative.stopServer();
    setState((prev) => ({ ...prev, isRunning: false, ip: null, alternateAddresses: [], error: null }));
  }, []);

  const addFileToShare = useCallback(
    async (uri: string, name: string) => {
      await initStorageDirs();
      const safeName = name.replace(/[/\\]/g, '_');
      await FileSystem.copyAsync({ from: uri, to: SHARED_DIR + safeName });
      await refreshFiles();
    },
    [refreshFiles]
  );

  const removeSharedFile = useCallback(
    async (name: string) => {
      await FileSystem.deleteAsync(SHARED_DIR + name, { idempotent: true });
      await refreshFiles();
    },
    [refreshFiles]
  );

  const removeUploadedFile = useCallback(
    async (name: string) => {
      await FileSystem.deleteAsync(UPLOADS_DIR + name, { idempotent: true });
      await refreshFiles();
    },
    [refreshFiles]
  );

  const sendText = useCallback((text: string) => {
    DropSyncNative.addPhoneText(text);
    refreshTextsAndActivities();
  }, [refreshTextsAndActivities]);

  const deleteText = useCallback((id: string) => {
    DropSyncNative.removeText(id);
    refreshTextsAndActivities();
  }, [refreshTextsAndActivities]);

  const value: ServerContextType = {
    ...state,
    startServerAction,
    stopServerAction,
    refreshFiles,
    addFileToShare,
    removeSharedFile,
    removeUploadedFile,
    sendText,
    deleteText,
    refreshTextsAndActivities,
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextType {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within ServerProvider');
  return ctx;
}
