# Red team findings

What the independent red team found, and what was decided. The full reports and
attack scripts are kept in private repositories, named below. Trial 1 and Audit 1
are in the private repository
`jbailey28/login-component-redteam`, branches `trial-1-results` and
`audit-1-results`.

## Trial 1 (2026-11-07, Fable 5.1): requirements 1 and 6

- **1. Wrong password never gets you in: held.** Six attacks, through the app and
  straight to Supabase.
- **6. A reset code works only once: broken.** Sent several times at the same
  instant, one code gave out up to 6 working logins. Reproduced on GitHub
  Actions. It's inside Supabase.
  - *Decided 2026-11-08:* accept as a known limit (an attacker already needs the
    code, which goes only to the owner's inbox; a reset logs out every other
    device). Report it to Supabase. Retest after
    the switch to links.

## Audit 1 (2026-11-07, Fable 5.1): beyond the 21 requirements

### Verified (demonstrated, and reproduced on GitHub Actions)

1. **Account pre-hijacking.** An attacker signs up with the owner's email and
   their own password. When the owner later signs up and confirms, Supabase
   keeps the attacker's password.
   - *Decided 2026-11-08:* **known limit, no fix.** Low likelihood. If it
     happens, the owner's password doesn't work, they use Forgot password, and
     the reset logs every device out, including the attacker's.
   - A sign-up function was considered and dropped the same day: "latest sign-up
     wins" only moves the gap, and a real fix (the person tapping the link sets
     the password) adds a step. Most apps on Supabase use its normal sign-up.
2. **Finding out which emails have accounts, straight from Supabase.**
   - *Decided 2026-11-08:* **known limit.** The app's own messages give nothing
     away; Supabase's direct answers still do. Rate limits and the robot check
     (A, D) slow down anyone checking many emails. A sign-up function in front of
     Supabase was approved, then dropped the same day to keep it simple.
   - Messages, approved 2026-11-08:
     - Forgot password: "If an account exists with this email address, we've
       sent a link to reset your password."
     - Create an Account: "Check your email. We've sent a link to confirm your
       account."
3. **A reset code is also accepted as a confirmation code.**
   - *Decided 2026-11-08:* no fix; it gives an attacker nothing new. Retest after
     the switch to links.

### Potential concerns (not demonstrated)

| | Concern | Decided 2026-11-08 |
|---|---|---|
| A | Rate limits are off in the local test Supabase, so they've never been proven | Test on a real project before launch (`GOING-LIVE.md`). Supabase limits per internet address, not per account: open gap against requirement 3 |
| B | The emailed code is the only protection for resets | Solved by links, as long as emails show only the link. Red team checks it |
| C | No second step at login | Optional add-on per app, passkeys first. Default: stay logged in, like Instagram. Face ID quick lock planned for later |
| D | No "are you a robot" check | Cloudflare Turnstile before launch, on sign-up and forgot password first |
| E | Logins can be renewed forever, with no maximum age | Kept on purpose: stay logged in. "Log out after 6 months unused" is an optional per-app setting (may need a paid Supabase plan) |
| F | No email when a password changes | "Password changed" and "email address changed" emails switched on by default |
| G | Anyone can sign up any email address | Kept open. "Only these email domains" is an optional per-app setting. Email flooding is covered by D, A and a proper email sender |
| H | No encryption on the local test Supabase | The component refuses a non-`https` Supabase address outside testing |

## Trial 2 (2026-11-08, Fable 5.1): the link version

Own repository (`jbailey28/login-component-redteam-2`, branch
`trial-2-results`), so it couldn't see any earlier results. Reproduced on GitHub
Actions: 13 passed, 1 skipped.

| Requirement | Result |
|---|---|
| 5. Can't use an account before confirming | Held |
| 6. A reset link works only once | Held when used one after another (see below) |
| 7. A reset link works only for its email | Held |
| 8. A reset link expires | Held. Shown with a 2-second window; the real 15 minutes can't be waited out in a test |
| 13. Login only returns to approved addresses | Held, including look-alike address tricks |
| 18. Password changes protect the account | Held. Supabase itself logs out other devices on a password change |
| Emails carry only a link | Held |

Every attack was shown able to fail. Nothing was left changed.

**Not tested by the red team: using one link several times at the same instant.**
A builder's check (`builder-check/` on the same branch, clearly not red team
work) did it: **one reset link gave 6 working logins in 2 of 3 rounds.** The
trial 1 finding still applies to links. It stays a known limit.

Other observations, not tested:
- The approved-address list matches by the start of the path, so
  `/auth/resetEVIL` is also accepted. The website itself is always the approved
  one, so 13 holds.
- Changing a password with a fresh login doesn't ask for the old password. The
  component never offers that; only the reset link changes passwords.

## Trial 3 (2026-11-08, Fable 5.1): Apple sign-in and Keychain storage

Own repository (`jbailey28/login-component-redteam-3`, branch
`trial-3-results`). Reproduced on GitHub Actions: 19 passed. Every attack was
shown able to fail. Nothing was left changed.

| Requirement | Result | Still needs |
|---|---|---|
| 9. Made-up or altered Apple tokens refused | **Held.** Junk, self-signed with perfect details, unsigned, altered, and a known signing trick, all refused, through the app and straight at Supabase | Replaying a real Apple token from an earlier login (the nonce should stop it) |
| 10. Apple tokens for a different app refused | **Partly.** The setting is pinned to one app ID. The live check couldn't be isolated | A real Apple token made for another app |
| 15. Login kept only in the Keychain | **Held off the phone.** Only the expected pieces are saved, nothing else, and logging out leaves nothing behind | On a phone: that it really is the Keychain |
| 19. Apple sign-in can't take over an account by matching email | **Held against forged tokens.** No access, and no Apple login was attached to the victim's account | A real Apple login using an email that already has an account |

The "still needs" items all require a real Apple login on a phone. They're in
`GOING-LIVE.md` item A3.

Other observations, not tested:
- `refresh_token_reuse_interval = 10`: a used renewal ticket keeps working for 10
  more seconds. It's Supabase's default, there to stop people being logged out
  by a slow network. Relevant to requirement 17.

## Trial 4 (2026-11-08, Fable 5.1): Google sign-in

Own repository (`jbailey28/login-component-redteam-4`, branch
`trial-4-results`). Reproduced on GitHub Actions: 8 passed, 2 skipped (the two
that need a real Google token). Every attack was shown able to fail. Nothing was
left changed.

| Requirement | Result | Still needs |
|---|---|---|
| 11. Made-up or altered Google tokens refused | **Held.** Six kinds of forged token refused straight at Supabase; a made-up one-time code refused through the app | — |
| 12. Google tokens for another app refused | **Partly.** A forged other-app token is refused, but by its signature, so the app check itself wasn't isolated | A real Google token made for another app |
| 13. Only returns to approved addresses | **Held.** Asking Supabase to return to an attacker's site falls back to the approved site. The app refuses any other return address and never trades its code | — |
| 19. No takeover by matching email | **Held against forged tokens.** No access, nothing attached to the victim's account | A real Google login with an email that already has an account |

Other observations, not tested:
- When a Google sign-in fails, Supabase's own return page includes its error
  text in the address (for example "Unable to exchange external code"). The app
  never shows or passes it on. It echoes only what the attacker sent, so nothing
  secret leaks. Relevant to requirement 20.
- Manual account linking is off, which also protects 19.

## Trial 5 (2026-11-08, Fable 5.1): logout, secret key, session expiry, errors

Own repository (`jbailey28/login-component-redteam-5`, branch
`trial-5-results`). Reproduced on GitHub Actions: 20 passed. Every attack was
shown able to fail. Nothing was left changed.

| Requirement | Result |
|---|---|
| 14. Logging out ends the login on Supabase's side | **Held**, with a limit (below) |
| 16. Secret key never in the app's code | **Held.** Nothing secret in `src/`; settings only point at environment variables |
| 17. Sessions expire securely | **Held**, with two details (below) |
| 20. Errors never expose secrets | **Held.** Every path returns a fixed message and logs nothing |

**Known limits found** (how Supabase works, not mistakes in the component):
- **After logging out, a copied short pass still reads data for up to its
  remaining life** (1 hour). Logging out stops renewals at once, and Supabase's
  login service refuses the pass at once, but the data side only checks the
  pass's own expiry. It matters once the app has tables. A shorter pass life
  shrinks the window.
- **A used renewal ticket still works for 10 seconds** (Supabase's default, to
  survive slow networks).
- **Spotting a reused ticket doesn't cancel the newer one.** Supabase refuses the
  old ticket but leaves the current login alone.

Not covered: the built app bundle and git history (16), and analytics (20),
since the component has none.

