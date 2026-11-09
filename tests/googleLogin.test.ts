import { describe, expect, it } from 'vitest';
import { createGoogleLogin, GOOGLE_MESSAGES } from '../src/googleLogin';
import { createPhoneClient, type SupabaseStorage } from '../src/secureStorage';
import { API_URL, PUBLIC_KEY } from './helpers';

/**
 * No real Google account is used. These check the component's own handling,
 * and that Supabase sends people to Google the safe way. Proving a REAL Google
 * sign-in works needs real Google keys (GOING-LIVE.md).
 */

const REDIRECT = 'loginstarter://auth/google';
const FAILED = { ok: false, cancelled: false, message: GOOGLE_MESSAGES.failed };

function memoryStorage(): SupabaseStorage {
  const m = new Map<string, string>();
  return {
    async getItem(k) { return m.get(k) ?? null; },
    async setItem(k, v) { m.set(k, v); },
    async removeItem(k) { m.delete(k); },
  };
}

const phone = () => createPhoneClient(API_URL, PUBLIC_KEY, memoryStorage());

describe('Continue with Google', () => {
  it('opens Supabase, which sends the person to Google with a one-time PKCE challenge', async () => {
    let opened = '';
    const google = createGoogleLogin(phone(), {
      redirectUrl: REDIRECT,
      openBrowser: async (url) => { opened = url; return { type: 'cancel' }; },
    });
    await google.signIn();

    const start = new URL(opened);
    expect(start.origin + start.pathname).toBe(`${API_URL}/auth/v1/authorize`);
    expect(start.searchParams.get('provider')).toBe('google');
    expect(start.searchParams.get('redirect_to')).toBe(REDIRECT);
    expect(start.searchParams.get('code_challenge')).toBeTruthy();
    expect(start.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');

    // Follow Supabase's first step: it must hand off to Google itself.
    const res = await fetch(opened, { redirect: 'manual' });
    const google_ = new URL(res.headers.get('location') ?? '');
    expect(google_.hostname).toBe('accounts.google.com');
    expect(google_.searchParams.get('client_id')).toBe(process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID);
    expect(google_.searchParams.get('redirect_uri')).toContain('/auth/v1/callback');
  });

  it('closing Google\'s page shows nothing', async () => {
    const google = createGoogleLogin(phone(), { redirectUrl: REDIRECT, openBrowser: async () => ({ type: 'cancel' }) });
    expect(await google.signIn()).toEqual({ ok: false, cancelled: true });
  });

  it('a browser error gets the plain message', async () => {
    const google = createGoogleLogin(phone(), { redirectUrl: REDIRECT, openBrowser: async () => { throw new Error('x'); } });
    expect(await google.signIn()).toEqual(FAILED);
  });

  it('a return to any other address is refused', async () => {
    const google = createGoogleLogin(phone(), {
      redirectUrl: REDIRECT,
      openBrowser: async () => ({ type: 'success', url: 'evilapp://auth/google?code=abc' }),
    });
    expect(await google.signIn()).toEqual(FAILED);
  });

  it('a return with no code, or with an error, is refused', async () => {
    for (const url of [`${REDIRECT}`, `${REDIRECT}?error=access_denied&error_description=nope`]) {
      const google = createGoogleLogin(phone(), { redirectUrl: REDIRECT, openBrowser: async () => ({ type: 'success', url }) });
      expect(await google.signIn()).toEqual(FAILED);
    }
  });

  it('a made-up code is refused', async () => {
    const google = createGoogleLogin(phone(), {
      redirectUrl: REDIRECT,
      openBrowser: async () => ({ type: 'success', url: `${REDIRECT}?code=00000000-0000-0000-0000-000000000000` }),
    });
    expect(await google.signIn()).toEqual(FAILED);
  });
});
