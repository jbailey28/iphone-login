import type { createEmailLogin } from '../src/emailLogin';
import type { createAppleLogin } from '../src/appleLogin';
import type { createGoogleLogin } from '../src/googleLogin';

/**
 * The three ways in, made by the app with createEmailLogin, createAppleLogin
 * and createGoogleLogin. Any of them can be null: the screens still show, and
 * that button says the app isn't connected yet.
 */
export type Logins = {
  email: ReturnType<typeof createEmailLogin> | null;
  apple: ReturnType<typeof createAppleLogin> | null;
  google: ReturnType<typeof createGoogleLogin> | null;
};

export const NOT_CONNECTED = "This app isn't connected to Supabase yet.";
