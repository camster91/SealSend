import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Session } from './model';
const key = 'sealsend-native-session-v1';
// Web preview is memory-only; credentials are never written to localStorage.
let preview: Session | null = null;
export async function readSession(): Promise<Session | null> {
  const raw = Platform.OS === 'web' ? preview : await SecureStore.getItemAsync(key);
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value.sessionToken !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.sessionToken) || value.user?.role !== 'admin' || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) { await saveSession(null); return null; }
    return value;
  } catch { await saveSession(null); return null; }
}
export async function saveSession(value: Session | null) {
  if (Platform.OS === 'web') { preview = value; return; }
  if (value) await SecureStore.setItemAsync(key, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(key);
}
