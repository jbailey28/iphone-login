import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * The local Supabase started inside CI (or a codespace) by `supabase start`.
 * Its address and public key are read from `.supabase-status.json`, which the
 * workflow writes with `supabase status -o json`. Nothing here is a real
 * project, so nothing here is a secret.
 */
function status(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(new URL('../.supabase-status.json', import.meta.url), 'utf8'));
  } catch {
    throw new Error('No .supabase-status.json. Run `npx supabase start` then `npx supabase status -o json > .supabase-status.json`.');
  }
}

const s = status();
export const API_URL = s.API_URL;
export const PUBLIC_KEY = s.PUBLISHABLE_KEY ?? s.ANON_KEY;
const MAILPIT = s.MAILPIT_URL ?? s.INBUCKET_URL ?? 'http://127.0.0.1:54324';

if (!API_URL || !PUBLIC_KEY) throw new Error('.supabase-status.json has no API_URL or public key.');

/** A fresh client each time, holding nothing between tests. */
export function newClient() {
  return createClient(API_URL, PUBLIC_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function newEmail() {
  return `t-${randomUUID()}@example.test`;
}

export const GOOD_PASSWORD = 'Correct-horse-42';

export const TEST_LINKS = {
  confirmUrl: 'http://127.0.0.1:3000/auth/confirm',
  resetUrl: 'http://127.0.0.1:3000/auth/reset',
  allowInsecureForTesting: true,
};

type Mail = { Subject: string; Text: string; HTML: string };

/** The newest email sent to `to` whose subject contains `subject`. */
export async function emailTo(to: string, subject: string): Promise<Mail> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
    const { messages = [] } = (await res.json()) as { messages?: { ID: string; Subject: string }[] };
    const hit = messages.find((m) => m.Subject.includes(subject));
    if (hit) return (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as Mail;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email to ${to} with "${subject}" arrived.`);
}

/** The link in the newest matching email. */
export async function linkFromEmail(to: string, subject: string): Promise<string> {
  const mail = await emailTo(to, subject);
  const href = mail.HTML.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error(`Email "${mail.Subject}" has no link.`);
  return href.replace(/&amp;/g, '&');
}
