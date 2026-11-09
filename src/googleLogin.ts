import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * "Continue with Google", through Google's own sign-in page.
 *
 * 1. Supabase gives back the address of Google's sign-in page.
 * 2. The app opens it in a secure in-app browser. The person picks an account.
 * 3. Google sends them to Supabase, and Supabase sends them back to the app's
 *    `redirectUrl` with a one-time code.
 * 4. The code is traded for a login. Only this device can do that: it holds the
 *    secret half of the exchange (PKCE), kept in the client's storage.
 *
 * A first-timer gets an account automatically.
 *
 * The browser is passed in, so this file has no phone-only imports. Use a
 * client from `createPhoneClient` (it sets the PKCE flow). In an Expo app:
 *
 *   import * as WebBrowser from 'expo-web-browser';
 *   import * as Linking from 'expo-linking';
 *
 *   const google = createGoogleLogin(supabase, {
 *     redirectUrl: Linking.createURL('auth/google'),
 *     openBrowser: (url, redirectUrl) => WebBrowser.openAuthSessionAsync(url, redirectUrl),
 *   });
 */

export type GoogleResult =
  | { ok: true; session: Session }
  /** The person closed Google's page. Show nothing. */
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

export const GOOGLE_MESSAGES = {
  failed: "Google sign-in didn't work. Try again, or use your email.",
} as const;

export type GoogleLoginOptions = {
  /** Where Google sign-in returns to. Must be on Supabase's allowed list (13). */
  redirectUrl: string;
  /** Opens the sign-in page and waits for the return to `redirectUrl`. */
  openBrowser: (
    url: string,
    redirectUrl: string,
  ) => Promise<{ type: 'success'; url: string } | { type: 'cancel' | 'dismiss' | 'locked' | string }>;
};

export function createGoogleLogin(supabase: SupabaseClient, options: GoogleLoginOptions) {
  const failed = { ok: false, cancelled: false, message: GOOGLE_MESSAGES.failed } as const;

  return {
    async signIn(): Promise<GoogleResult> {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: options.redirectUrl, skipBrowserRedirect: true },
      });
      if (error || !data.url) return failed;

      let result;
      try {
        result = await options.openBrowser(data.url, options.redirectUrl);
      } catch {
        return failed;
      }
      if (result.type !== 'success' || !('url' in result)) return { ok: false, cancelled: true };

      // Only accept a return to our own address. Anything else isn't ours.
      if (!result.url.startsWith(options.redirectUrl)) return failed;

      let code: string | null;
      try {
        code = new URL(result.url).searchParams.get('code');
      } catch {
        return failed;
      }
      if (!code) return failed;

      const exchange = await supabase.auth.exchangeCodeForSession(code);
      // Supabase's own error text is never passed on or logged (20).
      if (exchange.error || !exchange.data.session) return failed;
      return { ok: true, session: exchange.data.session };
    },
  };
}
