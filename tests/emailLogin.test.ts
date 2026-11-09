import { describe, expect, it } from 'vitest';
import { createEmailLogin, MESSAGES } from '../src/emailLogin';
import { emailTo, GOOD_PASSWORD, linkFromEmail, newClient, newEmail, TEST_LINKS } from './helpers';

/**
 * The builder's tests: does it do what it's for? The red team's tests, written
 * separately, try to break SECURITY-REQUIREMENTS.md.
 */

const login = () => createEmailLogin(newClient(), TEST_LINKS);

async function confirmedAccount() {
  const email = newEmail();
  expect((await login().createAccount(email, GOOD_PASSWORD)).ok).toBe(true);
  const link = await linkFromEmail(email, 'Confirm your email');
  expect((await login().openEmailLink(link)).ok).toBe(true);
  return email;
}

describe('setup', () => {
  it('refuses link pages that are not https outside tests', () => {
    expect(() => createEmailLogin(newClient(), { confirmUrl: 'http://x.test/c', resetUrl: 'https://x.test/r' })).toThrow(/https/);
    expect(() => createEmailLogin(newClient(), { confirmUrl: 'https://x.test/c', resetUrl: 'https://x.test/r' })).not.toThrow();
  });
});

describe('create an account', () => {
  it('emails a link, and the link confirms the account and logs in', async () => {
    const email = newEmail();
    expect(await login().createAccount(email, GOOD_PASSWORD)).toEqual({ ok: true, session: null, message: MESSAGES.confirmSent });
    const link = await linkFromEmail(email, 'Confirm your email');
    expect(link.startsWith(TEST_LINKS.confirmUrl + '?')).toBe(true);
    const r = await login().openEmailLink(link);
    expect(r.ok && r.kind).toBe('confirmed');
    expect(r.ok && r.session.user.email).toBe(email);
    expect((await login().signIn(email, GOOD_PASSWORD)).ok).toBe(true);
  });

  it('the email has a link and no 6-digit code', async () => {
    const email = newEmail();
    await login().createAccount(email, GOOD_PASSWORD);
    const mail = await emailTo(email, 'Confirm your email');
    expect(mail.Text + mail.HTML).not.toMatch(/\b\d{6}\b/);
  });

  it("can't log in before the link is tapped", async () => {
    const email = newEmail();
    await login().createAccount(email, GOOD_PASSWORD);
    expect(await login().signIn(email, GOOD_PASSWORD)).toEqual({ ok: false, message: MESSAGES.signInFailed });
  });

  it('a confirm link works once', async () => {
    const email = newEmail();
    await login().createAccount(email, GOOD_PASSWORD);
    const link = await linkFromEmail(email, 'Confirm your email');
    expect((await login().openEmailLink(link)).ok).toBe(true);
    expect(await login().openEmailLink(link)).toEqual({ ok: false, message: MESSAGES.linkFailed });
  });

  it('refuses a short password', async () => {
    expect(await login().createAccount(newEmail(), 'Short-1')).toEqual({ ok: false, message: MESSAGES.weakPassword });
  });

  // Each is 10+ characters and missing exactly one kind. Sent straight to
  // Supabase, so they prove its own setting, not just the app's check.
  it.each([
    ['no special character', 'Correcthorse42'],
    ['no number', 'Correct-horse-'],
    ['no uppercase', 'correct-horse-42'],
    ['no lowercase', 'CORRECT-HORSE-42'],
    ['a space is not a special character', 'Correct horse 42'],
  ])('Supabase refuses a password with %s', async (_why, password) => {
    const { error } = await newClient().auth.signUp({ email: newEmail(), password });
    expect(error?.code).toBe('weak_password');
  });

  it('answers the same for an email that already has an account', async () => {
    const email = await confirmedAccount();
    expect(await login().createAccount(email, GOOD_PASSWORD)).toEqual({ ok: true, session: null, message: MESSAGES.confirmSent });
  });
});

describe('log in', () => {
  it('a wrong password and an unknown email get the same answer', async () => {
    const email = await confirmedAccount();
    const wrong = await login().signIn(email, 'Not-the-password-99');
    const unknown = await login().signIn(newEmail(), 'Not-the-password-99');
    expect(wrong).toEqual({ ok: false, message: MESSAGES.signInFailed });
    expect(unknown).toEqual(wrong);
  });

  it('a link that has been tampered with is refused', async () => {
    expect(await login().openEmailLink(`${TEST_LINKS.confirmUrl}?token_hash=made-up&type=email`)).toEqual({ ok: false, message: MESSAGES.linkFailed });
    expect(await login().openEmailLink('not a link')).toEqual({ ok: false, message: MESSAGES.linkFailed });
  });
});

describe('forgot password', () => {
  it('a link sets a new password, logs everyone out, and the old password stops working', async () => {
    const email = await confirmedAccount();
    const otherDevice = newClient();
    const signedIn = await createEmailLogin(otherDevice, TEST_LINKS).signIn(email, GOOD_PASSWORD);
    expect(signedIn.ok).toBe(true);

    expect(await login().requestPasswordReset(email)).toEqual({ ok: true, session: null, message: MESSAGES.resetSent });
    const link = await linkFromEmail(email, 'Reset your password');
    expect(link.startsWith(TEST_LINKS.resetUrl + '?')).toBe(true);

    const device = login();
    const opened = await device.openEmailLink(link);
    expect(opened.ok && opened.kind).toBe('reset');
    const NEW = 'A-different-77';
    expect(await device.setNewPassword(NEW)).toEqual({ ok: true, session: null, message: MESSAGES.passwordChanged });

    // The other device's login is gone on Supabase's side.
    const token = signedIn.ok ? signedIn.session!.refresh_token : '';
    const { error } = await newClient().auth.refreshSession({ refresh_token: token });
    expect(error).not.toBeNull();

    expect((await login().signIn(email, NEW)).ok).toBe(true);
    expect((await login().signIn(email, GOOD_PASSWORD)).ok).toBe(false);
  });

  it('a reset link works once', async () => {
    const email = await confirmedAccount();
    await login().requestPasswordReset(email);
    const link = await linkFromEmail(email, 'Reset your password');
    expect((await login().openEmailLink(link)).ok).toBe(true);
    expect(await login().openEmailLink(link)).toEqual({ ok: false, message: MESSAGES.linkFailed });
  });

  it('a weak new password is refused, and a strong one still works after', async () => {
    const email = await confirmedAccount();
    await login().requestPasswordReset(email);
    const device = login();
    expect((await device.openEmailLink(await linkFromEmail(email, 'Reset your password'))).ok).toBe(true);
    expect(await device.setNewPassword('short1')).toEqual({ ok: false, message: MESSAGES.weakPassword });
    expect((await device.setNewPassword('A-different-77')).ok).toBe(true);
  });

  it('sends a "password changed" email', async () => {
    const email = await confirmedAccount();
    await login().requestPasswordReset(email);
    const device = login();
    await device.openEmailLink(await linkFromEmail(email, 'Reset your password'));
    await device.setNewPassword('A-different-77');
    expect((await emailTo(email, 'Your password was changed')).Subject).toBe('Your password was changed');
  });

  it('answers the same for an email with no account', async () => {
    expect(await login().requestPasswordReset(newEmail())).toEqual({ ok: true, session: null, message: MESSAGES.resetSent });
  });
});
