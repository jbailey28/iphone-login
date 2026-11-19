/**
 * The two pages the email links open, until the app has Universal Links:
 * "Confirm your email" (auth/confirm.html) and "Reset your password"
 * (auth/reset.html). They do in a browser what `openEmailLink` and
 * `setNewPassword` do in the app, with the same rules:
 *
 * - The link's code is taken out of the address bar before anything else, so
 *   it isn't left in the browser's history.
 * - The login a link gives is kept in memory only, never saved in the browser,
 *   and ended before the page says it's done.
 * - After a new password is saved, every device is logged out, this one too (18).
 * - Supabase's own error text is never shown (2).
 */

export const TEXT = {
  confirmed: 'Your email is confirmed. Go back to the app and log in.',
  linkFailed: "That link didn't work. It may have been used already, or it expired. Ask for a new one in the app.",
  tooManyTries: 'Too many tries. Wait a few minutes and try again.',
  weakPassword:
    'Password needs to be at least 10 characters with one uppercase letter, one lowercase letter, one number and one special character (like ! @ # or $).',
  passwordChanged: 'Your password was changed. Go back to the app and log in with your new password.',
  somethingWrong: 'Something went wrong. Try again.',
  notSetUp: "This page isn't set up yet. Add your Supabase address and publishable key to settings.js.",
  framed: 'Open this page in its own browser tab.',
};

/** Headings for when the page itself can't run, so they don't blame the link. */
const HEADINGS = { notSetUp: 'Not set up yet', framed: "This page can't open here" };

function isRateLimited(error) {
  return error.status === 429 || error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit';
}

/** A Supabase client that keeps its login in memory only. */
export function pageClient(createClient, settings, { allowInsecureForTesting = false } = {}) {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = settings;
  if (!url || !key) return null;
  if (!allowInsecureForTesting && !url.startsWith('https://')) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Reads the link's code and type, then takes them out of the address bar. */
export function takeLinkFromAddress(win) {
  const params = new URL(win.location.href).searchParams;
  const link = { tokenHash: params.get('token_hash'), type: params.get('type') };
  win.history.replaceState(null, '', win.location.pathname);
  return link;
}

/** Checks a link with Supabase. Returns { ok: true } or { ok: false, message }. */
export async function checkLink(client, { tokenHash, type }, expectedType) {
  if (!tokenHash || type !== expectedType) return { ok: false, message: TEXT.linkFailed };
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: expectedType });
  if (error || !data.session) {
    return { ok: false, message: error && isRateLimited(error) ? TEXT.tooManyTries : TEXT.linkFailed };
  }
  return { ok: true };
}

/** "Confirm your email": confirms the account, then ends the login the link gave. */
export async function confirmEmail(client, link) {
  const checked = await checkLink(client, link, 'email');
  if (!checked.ok) return checked;
  await client.auth.signOut({ scope: 'local' });
  return { ok: true, message: TEXT.confirmed };
}

/** "Reset your password", after `checkLink`: saves it, then logs out every device. */
export async function saveNewPassword(client, password) {
  const { error } = await client.auth.updateUser({ password });
  if (error) return { ok: false, message: error.code === 'weak_password' ? TEXT.weakPassword : TEXT.somethingWrong };
  await client.auth.signOut({ scope: 'global' });
  return { ok: true, message: TEXT.passwordChanged };
}

function show(doc, id) {
  for (const el of doc.querySelectorAll('[data-state]')) el.hidden = el.dataset.state !== id;
}

function say(doc, id, message, heading) {
  const section = doc.querySelector(`[data-state="${id}"]`);
  section.querySelector('[data-message]').textContent = message;
  if (heading) section.querySelector('h1').textContent = heading;
  show(doc, id);
}

/** Another site could show this page inside its own and trick people into typing there. */
function isFramed(win) {
  try {
    return win.top !== win.self;
  } catch {
    return true;
  }
}

function start(doc, win, deps) {
  if (isFramed(win)) {
    say(doc, 'failed', TEXT.framed, HEADINGS.framed);
    return null;
  }
  const link = takeLinkFromAddress(win);
  const client = pageClient(deps.createClient, deps.settings, deps);
  if (!client) {
    say(doc, 'failed', TEXT.notSetUp, HEADINGS.notSetUp);
    return null;
  }
  return { client, link };
}

/** Runs auth/confirm.html. `deps` is { createClient, settings }. */
export async function startConfirmPage(doc, win, deps) {
  const started = start(doc, win, deps);
  if (!started) return;
  const result = await confirmEmail(started.client, started.link);
  say(doc, result.ok ? 'done' : 'failed', result.message);
}

/** Runs auth/reset.html. `deps` is { createClient, settings }. */
export async function startResetPage(doc, win, deps) {
  const started = start(doc, win, deps);
  if (!started) return;
  const { client, link } = started;
  const checked = await checkLink(client, link, 'recovery');
  if (!checked.ok) return say(doc, 'failed', checked.message);
  show(doc, 'choose');

  const form = doc.querySelector('form');
  const input = form.querySelector('input[name="password"]');
  const button = form.querySelector('button[type="submit"]');
  const problem = form.querySelector('[data-problem]');
  const toggle = form.querySelector('[data-show]');

  const ready = () => { button.disabled = input.value.length === 0; };
  input.addEventListener('input', ready);
  ready();

  toggle.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Show' : 'Hide';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    problem.textContent = '';
    const result = await saveNewPassword(client, input.value);
    if (result.ok) {
      input.value = '';
      return say(doc, 'done', result.message);
    }
    problem.textContent = result.message;
    ready();
  });
}
