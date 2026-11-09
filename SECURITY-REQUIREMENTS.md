# Login: security requirements

Written 2026-11-07, before any login code exists. The red team tester checks
every one of these. A release is blocked until each one has held.

## Email and password

1. A wrong password never gets you in.
2. The wrong-password message doesn't reveal whether that email has an account.
3. Many wrong guesses in a row get blocked for a while.
4. Passwords shorter than a set length are refused. *(Set 2026-11-07: at least
   10 characters, with an uppercase letter, a lowercase letter, a number and a
   special character.)*
5. A new account can't be used until its email address is confirmed. *(By
   clicking the "Confirm your email" link. Changed from a code 2026-11-08.)*

## Forgot password

*Changed 2026-11-08 from codes to links, to match how most apps work.*

6. A reset link works only once.
7. A reset link works only for the email it was sent to.
8. A reset link stops working after a set time.

## Apple and Google

9. A made-up or altered Apple token is refused.
10. An Apple token made for a different app is refused.
11. A made-up or altered Google token is refused.
12. A Google token made for a different app is refused.

## Everywhere

13. Login only ever returns to addresses on an approved list.
14. Logging out ends the login on Supabase's side, not only on the phone.
15. The login is kept only in the Keychain. *(Checked by reading the code and by
    the phone checks.)*
16. The secret Supabase key never appears anywhere in the app's code.

## Sessions, accounts and errors

17. Sessions expire securely. Expired sessions cannot be reused indefinitely,
    and revoked refresh tokens cannot create new sessions.
    *(Note 2026-11-08: by choice, a login renews itself for as long as the app is
    used, like Instagram. Each short pass and each renewal ticket still stops
    working once used or cancelled.)*
18. Password changes protect the account. Changing a password requires
    appropriate verification and invalidates other sessions where supported.
    *(Whether Supabase does both by default is unconfirmed. The red team test
    shows what actually happens.)*
19. Accounts cannot be impersonated through OAuth. Apple or Google sign-in must
    not automatically grant access to an existing account merely because an
    unverified email address matches.
20. Authentication errors never expose secrets. Passwords, reset tokens, OAuth
    tokens, and session credentials must never appear in logs, analytics, or
    error messages.
21. Protected data requires authentication. Without a valid login, no request
    returns any user's data. *(Cross-user checks: Tables and privacy component.)*

## Red team results so far

- **Trial 1 (2026-11-07, Fable 5.1):** 1 held. 6 broke when the same reset code
  was sent several times at the same instant (it worked up to 6 times). Tested
  with codes; links go through the same part of Supabase, so it needs retesting
  after the change.
- **Audit 1 (2026-11-07, Fable 5.1):** see `FINDINGS.md`.
