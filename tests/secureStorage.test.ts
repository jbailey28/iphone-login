import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, createChunkedStorage, createPhoneClient, type KeyValueStore } from '../src/secureStorage';
import { createEmailLogin } from '../src/emailLogin';
import { API_URL, GOOD_PASSWORD, linkFromEmail, newClient, newEmail, PUBLIC_KEY, TEST_LINKS } from './helpers';

/**
 * A stand-in for the iPhone Keychain that is stricter than the real one: it
 * refuses anything over 2048 characters, where the real one only warns and may
 * fail. Kept in memory so it can be "reopened" like an app restart.
 */
function fakeKeychain() {
  const items = new Map<string, string>();
  const store: KeyValueStore = {
    async getItemAsync(k) {
      return items.has(k) ? items.get(k)! : null;
    },
    async setItemAsync(k, v) {
      if (v.length > 2048) throw new Error(`Keychain refused ${v.length} characters for ${k}`);
      items.set(k, v);
    },
    async deleteItemAsync(k) {
      items.delete(k);
    },
  };
  return { store, items };
}

describe('keeping the login on the phone', () => {
  it('a short value is saved whole', async () => {
    const { store, items } = fakeKeychain();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'hello');
    expect(await s.getItem('k')).toBe('hello');
    expect([...items.keys()]).toEqual(['k']);
  });

  it('a long value is split, every part fits, and it comes back the same', async () => {
    const { store, items } = fakeKeychain();
    const s = createChunkedStorage(store);
    const long = 'x'.repeat(CHUNK_SIZE * 3 + 7);
    await s.setItem('k', long);
    expect(await s.getItem('k')).toBe(long);
    expect(items.size).toBe(5); // index + 4 parts
    for (const v of items.values()) expect(v.length).toBeLessThanOrEqual(2048);
  });

  it('shrinking leaves no old parts behind', async () => {
    const { store, items } = fakeKeychain();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'x'.repeat(CHUNK_SIZE * 5));
    await s.setItem('k', 'y'.repeat(CHUNK_SIZE * 2));
    expect(await s.getItem('k')).toBe('y'.repeat(CHUNK_SIZE * 2));
    expect([...items.keys()].sort()).toEqual(['k', 'k.0', 'k.1']);
  });

  it('a missing part gives nothing back, not half a login', async () => {
    const { store, items } = fakeKeychain();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'x'.repeat(CHUNK_SIZE * 3));
    items.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
  });

  it('removing clears every part', async () => {
    const { store, items } = fakeKeychain();
    const s = createChunkedStorage(store);
    await s.setItem('k', 'x'.repeat(CHUNK_SIZE * 3));
    await s.removeItem('k');
    expect(items.size).toBe(0);
  });

  it('a real login is saved, survives an app restart, and is gone after logging out', async () => {
    const email = newEmail();
    const login = createEmailLogin(newClient(), TEST_LINKS);
    await login.createAccount(email, GOOD_PASSWORD);
    await login.openEmailLink(await linkFromEmail(email, 'Confirm your email'));

    const { store, items } = fakeKeychain();
    const first = createPhoneClient(API_URL, PUBLIC_KEY, createChunkedStorage(store));
    expect((await createEmailLogin(first, TEST_LINKS).signIn(email, GOOD_PASSWORD)).ok).toBe(true);
    // A real Supabase login is longer than one Keychain item can safely hold.
    expect(items.size).toBeGreaterThan(1);

    // "Restart": a brand-new client reading the same Keychain.
    const reopened = createPhoneClient(API_URL, PUBLIC_KEY, createChunkedStorage(store));
    const { data } = await reopened.auth.getUser();
    expect(data.user?.email).toBe(email);

    await createEmailLogin(reopened, TEST_LINKS).signOut();
    expect(items.size).toBe(0);
  });
});
