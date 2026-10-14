import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { DraftStore } from './draft-store';
const preview = new Map<string, string>();
export const drafts = new DraftStore({
  get: key => Platform.OS === 'web' ? Promise.resolve(preview.get(key) ?? null) : SecureStore.getItemAsync(key),
  set: async (key, value) => { if (Platform.OS === 'web') preview.set(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  remove: async key => { if (Platform.OS === 'web') preview.delete(key); else await SecureStore.deleteItemAsync(key); },
}, () => Crypto.randomUUID());
