import { requireNativeModule } from 'expo-modules-core';

export interface LocalAddress {
  interfaceName: string;
  address: string;
  isLikelyHotspot: boolean;
}

export interface ServerStatus {
  isRunning: boolean;
  port: number;
}

export interface NativeTextEntry {
  id: string;
  text: string;
  source: 'phone' | 'browser';
  timestamp: number;
}

export interface NativeActivityEntry {
  type: 'upload' | 'download' | 'text';
  filename?: string;
  size?: number;
  text?: string;
  timestamp: number;
}

interface DropSyncNativeModuleType {
  startServer(port: number): Promise<number>;
  stopServer(): boolean;
  getServerStatus(): ServerStatus;
  getLocalIpAddresses(): Promise<LocalAddress[]>;
  getTexts(): NativeTextEntry[];
  addPhoneText(text: string): boolean;
  removeText(id: string): boolean;
  getActivities(): NativeActivityEntry[];
}

export let isDropSyncNativeAvailable = false;

// Falls back to a safe no-op stub on platforms/environments where the native
// module isn't present (e.g. Expo Go, iOS, or web) so the JS bundle never crashes.
function loadNativeModule(): DropSyncNativeModuleType {
  try {
    const mod = requireNativeModule<DropSyncNativeModuleType>('DropSyncNative');
    isDropSyncNativeAvailable = true;
    return mod;
  } catch (e) {
    console.warn('[DropSyncNative] native module not available, using stub. ' +
      'This is expected in Expo Go — build a dev-client/APK to test the real server.');
    return {
      startServer: async () => {
        throw new Error('DropSyncNative is not available in this build (Expo Go?). Use a development build or APK.');
      },
      stopServer: () => false,
      getServerStatus: () => ({ isRunning: false, port: 0 }),
      getLocalIpAddresses: async () => [],
      getTexts: () => [],
      addPhoneText: () => false,
      removeText: () => false,
      getActivities: () => [],
    };
  }
}

const DropSyncNative = loadNativeModule();
export default DropSyncNative;
