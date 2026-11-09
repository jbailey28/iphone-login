import { createClient } from '@supabase/supabase-js';

/**
 * Where the login is kept on the phone, so people stay logged in after the app
 * closes (SECURITY-REQUIREMENTS 15).
 *
 * Supabase saves the login, including the long-lived renewal ticket, through
 * whatever storage it's handed. The usual React Native default is AsyncStorage,
 * which is unencrypted. Anyone with a copy of it, from a backup for example, has
 * the ticket, and the ticket is the account. The iOS Keychain is the safe place.
 *
 * WHY THE CHUNKING
 *   The Keychain (through expo-secure-store) warns above 2048 bytes and isn't
 *   guaranteed to store more. A Supabase login routinely exceeds that. Without
 *   chunking the save fails quietly, and the symptom is that the app logs
 *   people out every time it opens, with no error anywhere.
 *
 *   So a long value is split across `key.0`, `key.1`, … and a small index at
 *   `key` records how many parts there are. A short value is saved at `key`
 *   directly.
 *
 * It takes the store as an input, so it can be tested without a phone.
 */

/** The three functions expo-secure-store provides. Pass `* as SecureStore`. */
export type KeyValueStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** The shape Supabase expects for `auth.storage`. */
export type SupabaseStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Under the Keychain's 2048-byte warning, with room for the suffix. */
export const CHUNK_SIZE = 1800;
const INDEX = '__chunks:';

export function createChunkedStorage(store: KeyValueStore): SupabaseStorage {
  async function chunkCount(key: string): Promise<number> {
    const head = await store.getItemAsync(key);
    if (head && head.startsWith(INDEX)) {
      const n = parseInt(head.slice(INDEX.length), 10);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  async function clearChunks(key: string, count: number) {
    for (let i = 0; i < count; i++) await store.deleteItemAsync(`${key}.${i}`);
  }

  return {
    async getItem(key) {
      const head = await store.getItemAsync(key);
      if (head === null) return null;
      if (!head.startsWith(INDEX)) return head; // saved whole

      const n = parseInt(head.slice(INDEX.length), 10);
      let out = '';
      for (let i = 0; i < n; i++) {
        const part = await store.getItemAsync(`${key}.${i}`);
        // A missing part means a half-finished save or a half-finished wipe.
        // Half a login is worse than none: it would be handed to Supabase as if
        // it were whole.
        if (part === null) return null;
        out += part;
      }
      return out;
    },

    async setItem(key, value) {
      // Clear what was there first. Shrinking from five parts to two would
      // otherwise leave three behind in the Keychain that nothing reads.
      await clearChunks(key, await chunkCount(key));

      if (value.length <= CHUNK_SIZE) {
        await store.setItemAsync(key, value);
        return;
      }

      const parts: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) parts.push(value.slice(i, i + CHUNK_SIZE));
      // Parts first, index last. If this is interrupted, the index still points
      // at the old count or is missing, never at parts that weren't written.
      for (let i = 0; i < parts.length; i++) await store.setItemAsync(`${key}.${i}`, parts[i]);
      await store.setItemAsync(key, `${INDEX}${parts.length}`);
    },

    async removeItem(key) {
      await clearChunks(key, await chunkCount(key));
      await store.deleteItemAsync(key);
    },
  };
}

/**
 * The Supabase client for a phone app, with the login kept in `storage`.
 *
 * `detectSessionInUrl` is off: it tells Supabase to look for a login in a web
 * page's address, and a phone app has no page address. Leaving it on causes
 * confusing failures. Email links are handled by `openEmailLink` instead.
 *
 * Only the public key belongs here. The service-role key skips every database
 * rule and must never be in an app.
 */
export function createPhoneClient(url: string, publicKey: string, storage: SupabaseStorage) {
  return createClient(url, publicKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Google sign-in comes back with a one-time code that only this device
      // can trade for a login (PKCE). The secret half stays in `storage`.
      flowType: 'pkce',
    },
  });
}
