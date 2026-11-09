import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * "Continue with Apple" on an iPhone, on a Supabase client the app creates.
 *
 * The iPhone shows Apple's own sheet and hands back a signed token from Apple.
 * Supabase checks that token's signature against Apple's keys and that it was
 * made for this app (SECURITY-REQUIREMENTS 9 and 10), then logs the person in.
 * A first-timer gets an account automatically.
 *
 * THE NONCE
 *   A random one-time value made fresh for every sign-in. Apple is given its
 *   SHA-256 and writes that into the token; Supabase is given the original and
 *   checks they match. A token captured from an earlier sign-in carries a
 *   different value, so it can't be replayed.
 *
 * The Apple sheet and the hashing are passed in, so this file has no phone-only
 * imports and can be tested anywhere. In an Expo app:
 *
 *   import * as AppleAuthentication from 'expo-apple-authentication';
 *   import * as Crypto from 'expo-crypto';
 *
 *   const apple = createAppleLogin(supabase, {
 *     randomNonce: () => Crypto.randomUUID(),
 *     sha256: (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s),
 *     askApple: (hashedNonce) =>
 *       AppleAuthentication.signInAsync({
 *         requestedScopes: [
 *           AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
 *           AppleAuthentication.AppleAuthenticationScope.EMAIL,
 *         ],
 *         nonce: hashedNonce,
 *       }),
 *   });
 */

export type AppleResult =
  | { ok: true; session: Session }
  /** The person closed the Apple sheet. Show nothing. */
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

export const APPLE_MESSAGES = {
  failed: "Apple sign-in didn't work. Try again, or use your email.",
} as const;

export type AppleLoginDeps = {
  /** A fresh random string for every sign-in. */
  randomNonce: () => string | Promise<string>;
  /** SHA-256 of a string, as lowercase hex. */
  sha256: (value: string) => string | Promise<string>;
  /** Shows Apple's sheet. Resolves with Apple's answer, or throws ERR_REQUEST_CANCELED. */
  askApple: (hashedNonce: string) => Promise<{ identityToken: string | null }>;
};

export function createAppleLogin(supabase: SupabaseClient, deps: AppleLoginDeps) {
  return {
    async signIn(): Promise<AppleResult> {
      const rawNonce = await deps.randomNonce();
      const hashedNonce = await deps.sha256(rawNonce);

      let identityToken: string | null;
      try {
        ({ identityToken } = await deps.askApple(hashedNonce));
      } catch (e) {
        if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true };
        return { ok: false, cancelled: false, message: APPLE_MESSAGES.failed };
      }
      if (!identityToken) return { ok: false, cancelled: false, message: APPLE_MESSAGES.failed };

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });
      // Supabase's own error text is never passed on or logged (20).
      if (error || !data.session) return { ok: false, cancelled: false, message: APPLE_MESSAGES.failed };
      return { ok: true, session: data.session };
    },
  };
}
