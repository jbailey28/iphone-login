# What this needs to work for real

The component ships with **no real addresses or accounts in it**. Each app fills
these in. Tests use a local, throwaway Supabase and need none of this.

When this component is used in a new app, go down this list and say which items
are still missing.

## Settings each app fills in

| Setting | Example | Where it goes |
|---|---|---|
| Website for the link pages | `https://example.com/auth` | Supabase `site_url`, and the app's settings |
| App's link name | `myapp` | The app's settings, and Supabase's allowed list |
| Apple Team ID | `ABCDE12345` | The Universal Links file on the website |
| App's bundle ID | `com.example.myapp` | The app's settings, and the Universal Links file |

## Before real people use it

| # | What | Why | What breaks without it | OK to skip while testing? |
|---|---|---|---|---|
| 1 | **A website with two pages:** "Email confirmed" and "Set a new password" | Email links have to open somewhere until the app can open them, and afterward as a backup | Confirm and reset links lead nowhere | Yes: tests use a local address |
| 2 | **That website on Supabase's allowed list** | Supabase only sends people to addresses on the list (requirement 13) | Links are refused | Yes |
| 3 | **An email sender connected to Supabase** (for example Resend) | Supabase's built-in sender is for testing: a few emails an hour, and it can't be relied on | Confirm and reset emails stop arriving | Yes |
| 4 | **The rate limits checked on the real project** | The local test Supabase turns them off, so they've never been proven (audit concern A) | Guessing attacks and email flooding go unchecked | Yes, but must be done before launch |
| 5 | **"Password changed" and "email changed" emails** (on by default in the component; check they arrive) | Tells the real owner when their password or email changes (audit concern F) | A takeover gives the owner no warning | Yes |
| 6 | **The app points at Supabase's `https://` address** | Real Supabase encrypts everything; a copied test address doesn't (audit concern H). The component refuses a non-`https` address outside testing | Passwords travel unencrypted | Yes: tests use a local address |
| 7 | **Cloudflare Turnstile robot check** on sign-up and forgot password | Stops scripts creating accounts or flooding emails (audit concern D) | Sign-up and email abuse are cheap | Yes, but must be done before launch |

## Continue with Apple

| # | What | Why | What breaks without it |
|---|---|---|---|
| A1 | **Replace `host.exp.Exponent` with the app's own bundle ID** in Supabase's Apple settings (`client_id`) | `host.exp.Exponent` is Expo Go. While it's listed, an Apple login made for *any* Expo Go app is accepted as this app | Logins from other people's test apps could be accepted |
| A2 | **Turn on "Sign in with Apple"** for the app's ID in the Apple Developer account | Apple only signs logins for apps that have it turned on | The Apple sheet fails |
| A3 | **Test it on a phone** against a real Supabase project | The local test Supabase can't be reached from a phone, so a real Apple login has never been tried. The red team couldn't test these without one: a real Apple token reused from an earlier login is refused; a real Apple token made for another app is refused; a real Apple login with an email that already has an account doesn't get into that account; the login really is in the Keychain | Unknown until tried |

Native Apple sign-in needs no secret key.

**How to test A3 (the normal path):**
- Use a **staging** Supabase project: a separate project only for testing,
  never real users. The test build of the app points at it.
- Make a **TestFlight** build (needs A2) and run the phone checks on it.
- Set `expo.ios.usesAppleSignIn: true` in `app.json`. Without it the build can
  lack Apple's permission and fail with "error 1000".
- **Expo Go is not enough.** Apple treats Expo Go and the real app as two
  different apps, and gives the same person a different ID in each. Passing in
  Expo Go doesn't prove the real app works.

## Continue with Google

| # | What | Why | What breaks without it |
|---|---|---|---|
| G1 | **A Google Cloud project** with an OAuth client of type **"Web application"** | Supabase talks to Google on the app's behalf, as a web client | No Google sign-in |
| G2 | In that client, add **Supabase's callback** (`https://<project>.supabase.co/auth/v1/callback`) as an authorized redirect | Google only sends people back to addresses it was told about | Google shows an error page |
| G3 | Put the client ID and secret in **Supabase → Authentication → Providers → Google**. The secret never goes in the app or in git | Supabase needs them to finish the sign-in | No Google sign-in |
| G4 | Add the app's **return address** (for example `myapp://auth/google`) to Supabase's allowed list | Supabase only returns people to listed addresses (requirement 13) | The sign-in can't come back to the app |
| G5 | **Publish the Google "consent screen"** (from Testing to In production) | In Testing, only people you list by hand can sign in | Everyone else is turned away |
| G6 | **Test it on a phone** against the staging project | The tests here use fake Google keys, so a real Google sign-in has never been tried. The red team couldn't test these without one: a real Google token made for another app is refused; a real Google login with an email that already has an account doesn't get into that account | Unknown until tried |

In Expo Go the return address changes with the network (`exp://<address>:8081/--/auth/google`),
so it's awkward to list. The app's own build has a fixed one.

## For links to open the app (Universal Links: the planned final version)

| # | What | Why | What breaks without it |
|---|---|---|---|
| 8 | **Apple Developer account** (paid, $99 a year) | Only your own app, built under your account, can claim links | Links open the browser instead of the app |
| 9 | **The Universal Links file on the website** (`/.well-known/apple-app-site-association`), with the Team ID and bundle ID | Tells iPhones which links belong to the app | Same as 8 |
| 10 | **The app's own build**, not Expo Go | Expo Go is Expo's app, not yours, so it can't claim your links | Same as 8 |

Until 8–10 are done, the links open the website pages from item 1. Nobody's emails
change when they are done.

## Known limits (accepted 2026-11-08)

- **Someone can sign up with another person's email first** (audit finding 1). If
  that person later signs up, their password won't work; Forgot password fixes
  it and logs everyone else out.
- **Supabase itself reveals which emails have accounts** to anyone who skips the
  app (audit finding 2). The app's messages don't.
- **One reset link sent several times at the same instant can work more than
  once** (trial finding 6). Report it to Supabase.

- **After logging out, a copied short pass can still read data for up to 1
  hour** (red team trial 5). Logging out stops renewals at once. Shorten
  `jwt_expiry` if an app's data needs a smaller window.
- **A used renewal ticket keeps working for 10 seconds**, and spotting a reused
  ticket doesn't cancel the newer one (Supabase's defaults).

## Optional, per app

| What | When to choose it |
|---|---|
| Second step at login (passkeys first) | Apps holding sensitive data |
| Face ID quick lock when opening the app | Apps people open often and want fast |
| Log out after 6 months unused | Apps where a lost phone matters |
| Only allow these email domains | Private apps, like one company |

