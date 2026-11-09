import { createHash, generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { APPLE_MESSAGES, createAppleLogin, type AppleLoginDeps } from '../src/appleLogin';
import { API_URL, newClient, PUBLIC_KEY } from './helpers';

/**
 * No real Apple account is used. These check the component's own handling, and
 * that Supabase refuses Apple tokens that Apple didn't sign. Proving a REAL
 * Apple sign-in works needs a phone (the phone checks).
 */

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** A token shaped exactly like Apple's, but signed with our own key, not Apple's. */
function forgedAppleToken(hashedNonce: string, overrides: Record<string, unknown> = {}) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = { alg: 'RS256', kid: 'forged-key', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://appleid.apple.com',
    aud: 'host.exp.Exponent',
    sub: `000000.${randomUUID().replace(/-/g, '')}.0000`,
    email: `forged-${randomUUID()}@privaterelay.appleid.com`,
    email_verified: true,
    nonce: hashedNonce,
    nonce_supported: true,
    iat: now,
    exp: now + 600,
    ...overrides,
  };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign('RSA-SHA256').update(body).sign(privateKey);
  return `${body}.${b64url(sig)}`;
}

function deps(askApple: AppleLoginDeps['askApple'], nonce = 'fixed-nonce-for-test'): AppleLoginDeps {
  return { randomNonce: () => nonce, sha256, askApple };
}

describe('Continue with Apple', () => {
  it('closing the Apple sheet shows nothing', async () => {
    const apple = createAppleLogin(newClient(), deps(async () => { throw Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }); }));
    expect(await apple.signIn()).toEqual({ ok: false, cancelled: true });
  });

  it('any other Apple error gets the plain message', async () => {
    const apple = createAppleLogin(newClient(), deps(async () => { throw new Error('ERR_REQUEST_FAILED'); }));
    expect(await apple.signIn()).toEqual({ ok: false, cancelled: false, message: APPLE_MESSAGES.failed });
  });

  it('no token from Apple gets the plain message', async () => {
    const apple = createAppleLogin(newClient(), deps(async () => ({ identityToken: null })));
    expect(await apple.signIn()).toEqual({ ok: false, cancelled: false, message: APPLE_MESSAGES.failed });
  });

  it('Apple is given the hash of the nonce, never the nonce itself', async () => {
    let given = '';
    const apple = createAppleLogin(newClient(), deps(async (h) => { given = h; return { identityToken: 'not-a-token' }; }, 'raw-nonce-123'));
    await apple.signIn();
    expect(given).toBe(sha256('raw-nonce-123'));
    expect(given).not.toContain('raw-nonce-123');
  });

  it('a made-up token is refused', async () => {
    const apple = createAppleLogin(newClient(), deps(async () => ({ identityToken: 'made.up.token' })));
    expect(await apple.signIn()).toEqual({ ok: false, cancelled: false, message: APPLE_MESSAGES.failed });
  });

  it('a token shaped like Apple\'s but not signed by Apple is refused, through the app', async () => {
    const apple = createAppleLogin(newClient(), deps(async (h) => ({ identityToken: forgedAppleToken(h) })));
    expect(await apple.signIn()).toEqual({ ok: false, cancelled: false, message: APPLE_MESSAGES.failed });
  });

  it('the same forged token is refused straight at Supabase', async () => {
    const raw = 'direct-nonce';
    const res = await fetch(`${API_URL}/auth/v1/token?grant_type=id_token`, {
      method: 'POST',
      headers: { apikey: PUBLIC_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'apple', id_token: forgedAppleToken(sha256(raw)), nonce: raw }),
    });
    const body = (await res.json()) as { access_token?: string; error_code?: string; code?: string; msg?: string };
    expect(res.ok).toBe(false);
    expect(body.access_token).toBeUndefined();
    // It must be refused for the RIGHT reason: Apple's signature doesn't check
    // out. If Apple sign-in were simply switched off, a bare "refused" would
    // prove nothing.
    expect(JSON.stringify(body)).toContain('Bad ID token');

    // ...and Apple sign-in really is on, so the refusal is about the token.
    const settings = (await (await fetch(`${API_URL}/auth/v1/settings`, { headers: { apikey: PUBLIC_KEY } })).json()) as {
      external: Record<string, boolean>;
    };
    expect(settings.external.apple).toBe(true);
  });
});
