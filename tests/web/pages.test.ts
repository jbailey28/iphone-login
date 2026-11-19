// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { startConfirmPage, startResetPage, TEXT } from '../../web/pages.js';
import { settings as shippedSettings } from '../../web/settings.js';
import { createEmailLogin } from '../../src/emailLogin';
import { API_URL, GOOD_PASSWORD, linkFromEmail, newClient, newEmail, PUBLIC_KEY, TEST_LINKS } from '../helpers';

/**
 * The two web pages the email links open (web/auth/confirm.html and
 * web/auth/reset.html), run in a pretend browser against the local Supabase.
 * The pages' scripts are started by hand, with a pretend address bar, so each
 * test can open a real link from a real email.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const web = (path: string) => readFileSync(join(root, 'web', path), 'utf8');
const login = () => createEmailLogin(newClient(), TEST_LINKS);
const deps = {
  createClient,
  settings: { SUPABASE_URL: API_URL, SUPABASE_PUBLISHABLE_KEY: PUBLIC_KEY },
  allowInsecureForTesting: true,
};

/** A pretend window: the address the link opened, and what the page did to it. */
function pretendWindow(href: string) {
  const url = new URL(href);
  const win = {
    location: { href: url.href, pathname: url.pathname },
    replacedWith: [] as string[],
    history: { replaceState: (_s: unknown, _t: string, to: string) => win.replacedWith.push(to) },
    top: null as unknown,
    self: null as unknown,
  };
  win.top = win;
  win.self = win;
  return win;
}

function loadPage(name: 'confirm' | 'reset') {
  const html = web(`auth/${name}.html`);
  document.body.innerHTML = html.slice(html.indexOf('<main>'), html.indexOf('</main>') + 7);
}

const shown = () => document.querySelector('[data-state]:not([hidden])')?.getAttribute('data-state');
const message = () => document.querySelector('[data-state]:not([hidden]) [data-message]')?.textContent;

async function unconfirmedAccount() {
  const email = newEmail();
  await login().createAccount(email, GOOD_PASSWORD);
  return { email, link: await linkFromEmail(email, 'Confirm your email') };
}

async function confirmedAccount() {
  const { email, link } = await unconfirmedAccount();
  expect((await login().openEmailLink(link)).ok).toBe(true);
  return email;
}

async function resetLink(email: string) {
  await login().requestPasswordReset(email);
  return linkFromEmail(email, 'Reset your password');
}

async function openReset(link: string) {
  loadPage('reset');
  await startResetPage(document, pretendWindow(link), deps);
}

async function submitPassword(password: string) {
  const input = document.querySelector<HTMLInputElement>('input[name="password"]')!;
  input.value = password;
  input.dispatchEvent(new Event('input'));
  document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  // The page answers once Supabase has; wait for the button or the page to change.
  for (let i = 0; i < 100 && shown() === 'choose' && !document.querySelector('[data-problem]')!.textContent; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('the "Confirm your email" page', () => {
  it('confirms the account, says so, and cleans the address bar', async () => {
    const { email, link } = await unconfirmedAccount();
    expect((await login().signIn(email, GOOD_PASSWORD)).ok).toBe(false);

    loadPage('confirm');
    const win = pretendWindow(link);
    await startConfirmPage(document, win, deps);

    expect(shown()).toBe('done');
    expect(message()).toBe(TEXT.confirmed);
    expect(win.replacedWith).toEqual(['/auth/confirm']);
    expect((await login().signIn(email, GOOD_PASSWORD)).ok).toBe(true);
  });

  it('a link works once', async () => {
    const { link } = await unconfirmedAccount();
    loadPage('confirm');
    await startConfirmPage(document, pretendWindow(link), deps);
    loadPage('confirm');
    await startConfirmPage(document, pretendWindow(link), deps);
    expect(shown()).toBe('failed');
    expect(message()).toBe(TEXT.linkFailed);
  });

  it('refuses a reset link', async () => {
    const link = await resetLink(await confirmedAccount());
    loadPage('confirm');
    await startConfirmPage(document, pretendWindow(link.replace('/auth/reset', '/auth/confirm')), deps);
    expect(shown()).toBe('failed');
  });

  it('refuses a made-up link', async () => {
    loadPage('confirm');
    await startConfirmPage(document, pretendWindow('http://127.0.0.1:3000/auth/confirm?token_hash=abc&type=email'), deps);
    expect(shown()).toBe('failed');
    expect(message()).toBe(TEXT.linkFailed);
  });

  it('keeps nothing in the browser', async () => {
    const { link } = await unconfirmedAccount();
    loadPage('confirm');
    await startConfirmPage(document, pretendWindow(link), deps);
    expect(shown()).toBe('done');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
});

describe('the "Reset your password" page', () => {
  it('saves a new password, logs out every device, and cleans the address bar', async () => {
    const email = await confirmedAccount();
    const otherDevice = await login().signIn(email, GOOD_PASSWORD);
    const link = await resetLink(email);

    loadPage('reset');
    const win = pretendWindow(link);
    await startResetPage(document, win, deps);
    expect(shown()).toBe('choose');
    expect(win.replacedWith).toEqual(['/auth/reset']);
    // The link's login exists now, while the page waits for a password: in memory only.
    expect(localStorage.length + sessionStorage.length).toBe(0);

    const NEW = 'Brand-new-pass-77';
    await submitPassword(NEW);
    expect(shown()).toBe('done');
    expect(message()).toBe(TEXT.passwordChanged);

    // The other device's login is gone on Supabase's side (18).
    const token = otherDevice.ok ? otherDevice.session!.refresh_token : '';
    expect((await newClient().auth.refreshSession({ refresh_token: token })).error).not.toBeNull();

    expect((await login().signIn(email, NEW)).ok).toBe(true);
    expect((await login().signIn(email, GOOD_PASSWORD)).ok).toBe(false);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('refuses a weak password and lets the person try again', async () => {
    const email = await confirmedAccount();
    await openReset(await resetLink(email));
    await submitPassword('short');
    expect(shown()).toBe('choose');
    expect(document.querySelector('[data-problem]')!.textContent).toBe(TEXT.weakPassword);

    await submitPassword('Brand-new-pass-77');
    expect(shown()).toBe('done');
  });

  it('a link works once', async () => {
    const link = await resetLink(await confirmedAccount());
    await openReset(link);
    expect(shown()).toBe('choose');
    await openReset(link);
    expect(shown()).toBe('failed');
    expect(message()).toBe(TEXT.linkFailed);
  });

  it('refuses a confirm link', async () => {
    const { link } = await unconfirmedAccount();
    await openReset(link.replace('/auth/confirm', '/auth/reset'));
    expect(shown()).toBe('failed');
  });

  it('Show and Hide switch the password between dots and letters', async () => {
    await openReset(await resetLink(await confirmedAccount()));
    const input = document.querySelector<HTMLInputElement>('input[name="password"]')!;
    const toggle = document.querySelector<HTMLButtonElement>('[data-show]')!;
    expect(input.type).toBe('password');
    toggle.click();
    expect(input.type).toBe('text');
    toggle.click();
    expect(input.type).toBe('password');
  });
});

describe('both pages', () => {
  it('say they are not set up, and contact nobody, without an https address', async () => {
    for (const settings of [
      { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' },
      { SUPABASE_URL: 'http://example.test', SUPABASE_PUBLISHABLE_KEY: 'k' },
    ]) {
      let called = false;
      const spy = { createClient: (() => { called = true; }) as never, settings };
      loadPage('confirm');
      await startConfirmPage(document, pretendWindow('https://x.test/auth/confirm?token_hash=a&type=email'), spy);
      expect(message()).toBe(TEXT.notSetUp);
      expect(document.querySelector('[data-state="failed"] h1')!.textContent).toBe('Not set up yet');
      loadPage('reset');
      await startResetPage(document, pretendWindow('https://x.test/auth/reset?token_hash=a&type=recovery'), spy);
      expect(message()).toBe(TEXT.notSetUp);
      expect(called).toBe(false);
    }
  });

  it('refuse to work inside another site', async () => {
    const { link } = await unconfirmedAccount();
    const win = pretendWindow(link);
    win.top = {};
    loadPage('confirm');
    await startConfirmPage(document, win, deps);
    expect(message()).toBe(TEXT.framed);
    // The link was never used, so it still works.
    expect((await login().openEmailLink(link)).ok).toBe(true);
  });

  it('load nothing from other sites, and block outside scripts and form sending', () => {
    for (const page of ['auth/confirm.html', 'auth/reset.html']) {
      const html = web(page);
      expect(html).toContain(`script-src 'self'`);
      expect(html).toContain(`form-action 'none'`);
      expect(html).toContain('<meta name="referrer" content="no-referrer">');
      expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);
    }
  });

  it('ship with no real addresses in settings.js', () => {
    expect(shippedSettings).toEqual({ APP_NAME: '', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' });
  });

  it("use Supabase's own browser build, unchanged", () => {
    const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
    const vendored = join(root, 'web', 'supabase.js');
    const fromNpm = join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
    expect(sha(vendored)).toBe(sha(fromNpm));
  });
});
