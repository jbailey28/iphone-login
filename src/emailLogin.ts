import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Email and password login, on a Supabase client the app creates.
 *
 * Every function returns a result instead of throwing, and every failure
 * message is one of the fixed strings below. Supabase's own error text is never
 * passed through: it can say whether an email has an account
 * (SECURITY-REQUIREMENTS 2), and it is never logged (20).
 *
 * Confirming an email and resetting a password both work by LINK. The email
 * holds a link to one of the app's own pages; that page (or the app itself, once
 * it has Universal Links) passes the address it was opened with to
 * `openEmailLink`.
 */

export type Result =
  | { ok: true; session: Session | null; message?: string }
  | { ok: false; message: string };

export type LinkResult =
  | { ok: true; kind: 'confirmed'; session: Session }
  | { ok: true; kind: 'reset'; session: Session }
  | { ok: false; message: string };

export const MESSAGES = {
  /** The same words for a wrong password, an unknown email and an unconfirmed account. */
  signInFailed:
    "That email and password don't match. If you just created an account, tap the link we emailed you first.",
  tooManyTries: 'Too many tries. Wait a few minutes and try again.',
  /** The same words whether or not the email already has an account. Approved 2026-11-08. */
  confirmSent: "Check your email. We've sent a link to confirm your account.",
  /** The same words whether or not the email has an account. Approved 2026-11-08. */
  resetSent: "If an account exists with this email address, we've sent a link to reset your password.",
  linkFailed: "That link didn't work. It may have been used already, or it expired. Ask for a new one.",
  weakPassword:
    'Password needs to be at least 10 characters with one uppercase letter, one lowercase letter, one number and one special character (like ! @ # or $).',
  passwordChanged: 'Your password was changed. Log in with your new password.',
  somethingWrong: 'Something went wrong. Try again.',
} as const;

export type EmailLoginOptions = {
  /** The page a "Confirm your email" link opens. Must be on Supabase's allowed list (13). */
  confirmUrl: string;
  /** The page a "Reset your password" link opens. Must be on Supabase's allowed list (13). */
  resetUrl: string;
  /**
   * Only for tests against a local Supabase. Without it, both addresses must be
   * https, so nothing travels unencrypted.
   */
  allowInsecureForTesting?: boolean;
};

function isRateLimited(error: { status?: number; code?: string }): boolean {
  return error.status === 429 || error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit';
}

function isWeakPassword(error: { code?: string }): boolean {
  return error.code === 'weak_password';
}

function requireHttps(name: string, url: string) {
  if (!url.startsWith('https://')) {
    throw new Error(`${name} must start with https:// (got ${url}). Use allowInsecureForTesting only in tests.`);
  }
}

export function createEmailLogin(supabase: SupabaseClient, options: EmailLoginOptions) {
  if (!options.allowInsecureForTesting) {
    requireHttps('confirmUrl', options.confirmUrl);
    requireHttps('resetUrl', options.resetUrl);
  }

  return {
    async signIn(email: string, password: string): Promise<Result> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { ok: false, message: isRateLimited(error) ? MESSAGES.tooManyTries : MESSAGES.signInFailed };
      }
      return { ok: true, session: data.session };
    },

    /**
     * Sends a "Confirm your email" link. Answers the same way when the email
     * already has an account, so this can't be used to find out which emails are
     * signed up (2).
     */
    async createAccount(email: string, password: string): Promise<Result> {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: options.confirmUrl },
      });
      if (error) {
        // Supabase answers "User already registered" here. Passing that on
        // would tell anyone which emails have accounts. Supabase still says it
        // to someone calling it directly; see SECURITY-REQUIREMENTS 2.
        if (error.code === 'user_already_exists') return { ok: true, session: null, message: MESSAGES.confirmSent };
        if (isWeakPassword(error)) return { ok: false, message: MESSAGES.weakPassword };
        if (isRateLimited(error)) return { ok: false, message: MESSAGES.tooManyTries };
        return { ok: false, message: MESSAGES.somethingWrong };
      }
      return { ok: true, session: null, message: MESSAGES.confirmSent };
    },

    /** Always answers the same way, account or not (2). */
    async requestPasswordReset(email: string): Promise<Result> {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: options.resetUrl });
      if (error && isRateLimited(error)) return { ok: false, message: MESSAGES.tooManyTries };
      return { ok: true, session: null, message: MESSAGES.resetSent };
    },

    /**
     * Called with the address an email link opened. A confirm link finishes
     * creating the account and logs the person in. A reset link gives a short
     * login that can only be used to choose a new password with `setNewPassword`.
     */
    async openEmailLink(url: string): Promise<LinkResult> {
      let tokenHash: string | null = null;
      let type: string | null = null;
      try {
        const params = new URL(url).searchParams;
        tokenHash = params.get('token_hash');
        type = params.get('type');
      } catch {
        return { ok: false, message: MESSAGES.linkFailed };
      }
      if (!tokenHash || (type !== 'email' && type !== 'recovery')) {
        return { ok: false, message: MESSAGES.linkFailed };
      }

      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error || !data.session) {
        return { ok: false, message: error && isRateLimited(error) ? MESSAGES.tooManyTries : MESSAGES.linkFailed };
      }
      return { ok: true, kind: type === 'email' ? 'confirmed' : 'reset', session: data.session };
    },

    /**
     * After a reset link: sets the new password, then logs out EVERY device,
     * this one included. The person logs in again with the new password, which
     * proves they know it, and anyone who knew the old one is cut off (18).
     */
    async setNewPassword(newPassword: string): Promise<Result> {
      const update = await supabase.auth.updateUser({ password: newPassword });
      if (update.error) {
        return { ok: false, message: isWeakPassword(update.error) ? MESSAGES.weakPassword : MESSAGES.somethingWrong };
      }
      await supabase.auth.signOut({ scope: 'global' });
      return { ok: true, session: null, message: MESSAGES.passwordChanged };
    },

    /** Ends this login on Supabase's side, not only on the device (14). */
    async signOut(): Promise<Result> {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return { ok: false, message: MESSAGES.somethingWrong };
      return { ok: true, session: null };
    },
  };
}
