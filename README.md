# iPhone Login

Login for a new iPhone app: email and password (with forgot password and create
account), Apple, and Google, on Supabase. It comes with the sign-in pages, ready
to use.

<!-- Walkthrough video goes here. -->

> **Status:** every part is tested on GitHub, and the security was tested by an
> independent red team (see `FINDINGS.md`). It has **not** been tested yet on a
> real iPhone or with a real (hosted) Supabase project. `GOING-LIVE.md` lists what
> to check before real users sign in.

## How to add it to your app

For an Expo app:

1. Download this repository (**Code → Download ZIP**) and copy the `src` and `ui`
   folders into your app, for example as `login/src` and `login/ui`.
2. Install what they use:
   ```
   npx expo install @supabase/supabase-js expo-secure-store expo-apple-authentication expo-crypto expo-web-browser expo-linking react-native-svg react-native-safe-area-context
   ```
3. Connect the logins and show the pages:
   ```tsx
   import * as SecureStore from 'expo-secure-store';
   import * as AppleAuthentication from 'expo-apple-authentication';
   import * as Crypto from 'expo-crypto';
   import * as WebBrowser from 'expo-web-browser';
   import * as Linking from 'expo-linking';
   import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
   import { createChunkedStorage, createPhoneClient } from './login/src/secureStorage';
   import { createEmailLogin } from './login/src/emailLogin';
   import { createAppleLogin } from './login/src/appleLogin';
   import { createGoogleLogin } from './login/src/googleLogin';
   import { LoginFlow } from './login/ui';

   // Your project's address and publishable key. Never the secret key.
   const supabase = createPhoneClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, createChunkedStorage(SecureStore));

   const email = createEmailLogin(supabase, {
     confirmUrl: 'https://your-site.com/auth/confirm',
     resetUrl: 'https://your-site.com/auth/reset',
   });
   const apple = createAppleLogin(supabase, {
     randomNonce: () => Crypto.randomUUID(),
     sha256: (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s),
     askApple: (hashedNonce) =>
       AppleAuthentication.signInAsync({
         requestedScopes: [
           AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
           AppleAuthentication.AppleAuthenticationScope.EMAIL,
         ],
         nonce: hashedNonce,
       }),
   });
   const google = createGoogleLogin(supabase, {
     redirectUrl: Linking.createURL('auth/google'),
     openBrowser: (url, redirect) => WebBrowser.openAuthSessionAsync(url, redirect),
   });

   export default function App() {
     const linkUrl = Linking.useURL();
     return (
       <SafeAreaProvider>
         <SafeAreaView style={{ flex: 1 }}>
           <LoginFlow
             supabase={supabase}
             logins={{ email, apple, google }}
             linkUrl={linkUrl}
             signedIn={(session) => <YourHomePage />}
           />
         </SafeAreaView>
       </SafeAreaProvider>
     );
   }
   ```
4. Set up your Supabase project. Open your project on supabase.com and click
   **Authentication** in the left menu.

   **Sign In / Providers**

   Under **User Signups**:
   - Allow new users to sign up: **on**
   - Confirm email: **on**

   Then click **Email** in the list of providers:
   - Secure email change: **on**
   - Secure password change: **on**
   - Minimum password length: **10**
   - Password requirements: **Lowercase, uppercase letters, digits and symbols**
   - Email OTP expiration: **900** (seconds, so links stop working after 15 minutes)

   **URL Configuration**
   - Site URL: your website, for example `https://your-site.com`
   - Redirect URLs: click **Add URL** and add all three:
     - `https://your-site.com/auth/confirm`
     - `https://your-site.com/auth/reset`
     - your app's Google return address, for example `yourapp://auth/google`

   **Emails → Templates**

   Open each one, set the subject, and paste in the file from `supabase/templates/`:

   | Template | Subject | File |
   |---|---|---|
   | Confirm sign up | Confirm your email | `confirmation.html` |
   | Reset password | Reset your password | `recovery.html` |

   Under **Security**, switch these two on, then open each one the same way:

   | Template | Subject | File |
   |---|---|---|
   | Password changed | Your password was changed | `password_changed.html` |
   | Email address changed | Your email address was changed | `email_changed.html` |

   Use these files, not Supabase's built-in emails. The links in them are made
   to open your app's pages.

   **Sign In / Providers → Apple and Google**

   Turn both on. Apple needs your app's bundle ID. Google needs a client ID and
   secret from Google Cloud. `GOING-LIVE.md` walks through both.

   **Before real users:** Supabase's built-in email service has low sending
   limits and isn't meant for live apps. Set up your own email sender under
   **Emails → SMTP Settings**. The rest of the launch checks are in
   `GOING-LIVE.md`.

## What you need

Read this first when using the component in a new app, and say which items are
missing. `GOING-LIVE.md` has the full before-launch list.

**To use it at all**

| Requirement | Why | Cost |
|---|---|---|
| A **Supabase account** and a project | The login runs on it | Free plan works |
| An app written in **JavaScript or TypeScript** (Expo, React Native, or a website) | The component is TypeScript and uses Supabase's JavaScript library | Free |
| A **website with `https://`** for two link pages: "Email confirmed" and "Set a new password" | Email links have to open somewhere | A domain, about $10–20 a year |
| An **email sender** (for example Resend) connected to Supabase | Supabase's built-in sender is only for testing | Free plan for small apps |
| **React Native** (Expo is the easiest way to get it), for the sign-in pages | The pages in `ui/` are phone-app pages. A website can use the login code in `src/` and make its own pages | Free |

**For an iPhone app**

| Requirement | Why | Cost |
|---|---|---|
| An **Apple Developer account** | Universal Links, Apple sign-in, and the App Store | $99 a year |
| A **safe place on the phone to keep the login** (the iOS Keychain) | So people stay logged in safely | Free. Included: `src/secureStorage.ts`. The app installs `expo-secure-store` |

**For Google sign-in**: a Google Cloud project with sign-in keys. Free.

**Before launch**: a Cloudflare account for the robot check (free), and the rest
of `GOING-LIVE.md`.

**To run the tests**: Node 22 and Docker, or a GitHub account to run them on
GitHub Actions or in a codespace. Free for normal use.

## Installing

```
npm install --legacy-peer-deps
```

The flag works around a bug in npm's installer with this version of the test
tool. (It's also in `.npmrc`, which the component library leaves out of copies.)

## Running the tests

`scripts/test-in-codespace.sh` runs every test in a GitHub codespace, never on
this computer. It tests the folder it's run from, exactly as it is. The tests
also run on GitHub Actions on every push.

## The plan (updated 2026-11-08)

- **Create an account:** email and password, then a **"Confirm your email"
  link**, then log in. The account can't be used before the link is clicked.
- **Forgot password:** a **"Reset password" link**, then a page to set a new
  password, then log in with it.
- **Links open the app through Apple's Universal Links. That's the final
  version.** It switches on once the app has an Apple Developer account. Until
  then the same links open two small web pages.
- **No real addresses or accounts are built in.** Each app fills in its own
  website, link name and Apple details. `GOING-LIVE.md` lists what's needed and
  what breaks without it.

## Built so far

**Email and password, with links** (log in, create an account with a "Confirm
your email" link, forgot password with a "Reset your password" link, log out).
**Continue with Apple** (native, with a nonce) and **Continue with Google**
(Google's own sign-in page, with PKCE). `GOING-LIVE.md` says what each app sets
up before launch. **The sign-in pages** (2026-11-09), tested by clicking through
them in a pretend browser. 56 builder tests pass on GitHub Actions.

- `SECURITY-REQUIREMENTS.md`: the 21 things login must never allow. Written
  before any code, on 2026-11-07. 5–8 changed to links on 2026-11-08.
- `GOING-LIVE.md`: what each app has to fill in or set up before real use.
- `FINDINGS.md`: what the red team found, and what was decided.
- `src/emailLogin.ts`: the login functions an app calls.
- `src/appleLogin.ts`: "Continue with Apple" on an iPhone.
- `src/googleLogin.ts`: "Continue with Google", through Google's sign-in page.
- `src/secureStorage.ts`: keeps the login in the iPhone Keychain, split into
  pieces small enough to fit.
- `ui/`: the sign-in pages, and `LoginFlow`, which shows them in order.
- `supabase/config.toml` and `supabase/templates/`: the Supabase login settings
  and the emails.
- `tests/`: the builder's tests. `tests/ui/` clicks through the pages. They check it does what it's for. They are not
  the red team test.
- `.devcontainer/`: the codespace setup. Node 22, and Docker so Supabase can run
  inside the codespace.

## How it's tested

- It's built with Opus.
- It's red-team tested with Fable, in a separate, fresh codespace that holds only
  this code and the security requirements.
- Supabase runs inside the codespace and is thrown away after each run. No real
  Supabase project is used, so no access token is needed.
- The final proof runs on GitHub Actions on every change.

## What never goes in this repository

- Builder notes. The red team tester must see only the code and the
  requirements. `tests/`, `FINDINGS.md` and the git history are left out of every
  red team snapshot.
- Keys, tokens, or `.env` files.

## License

MIT. See `LICENSE`.
