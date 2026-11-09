// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { LoginFlow } from '../../ui/LoginFlow';
import { NOT_CONNECTED, type Logins } from '../../ui/logins';
import { MESSAGES } from '../../src/emailLogin';
import { APPLE_MESSAGES } from '../../src/appleLogin';

/**
 * The sign-in pages, clicked through in a pretend browser. The logins are
 * stand-ins that answer the way the real ones do (the real ones are tested
 * against Supabase in the other test files). These check the pages: what each
 * one says, where each button goes, and that only the component's own words
 * are ever shown.
 */

const RULES =
  'At least 10 characters, including an uppercase letter, a lowercase letter, a number, and a special character.';

afterEach(cleanup);

function fakeLogins() {
  const email = {
    signIn: vi.fn(async () => ({ ok: false as const, message: MESSAGES.signInFailed })),
    createAccount: vi.fn(async () => ({ ok: true as const, session: null, message: MESSAGES.confirmSent })),
    requestPasswordReset: vi.fn(async () => ({ ok: true as const, session: null, message: MESSAGES.resetSent })),
    openEmailLink: vi.fn(async () => ({ ok: false as const, message: MESSAGES.linkFailed })),
    setNewPassword: vi.fn(async () => ({ ok: true as const, session: null, message: MESSAGES.passwordChanged })),
    signOut: vi.fn(async () => ({ ok: true as const, session: null })),
  };
  const apple = { signIn: vi.fn(async () => ({ ok: false as const, cancelled: true as const })) };
  const google = { signIn: vi.fn(async () => ({ ok: false as const, cancelled: true as const })) };
  return { email, apple, google, logins: { email, apple, google } as unknown as Logins };
}

/** A stand-in Supabase that reports `start` as the saved login, and lets a test log in or out. */
function fakeSupabase(start: Session | null = null) {
  let listener: (event: string, s: Session | null) => void = () => {};
  const client = {
    auth: {
      getSession: async () => ({ data: { session: start } }),
      onAuthStateChange: (fn: typeof listener) => {
        listener = fn;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  } as unknown as SupabaseClient;
  return { client, emit: (s: Session | null) => listener(s ? 'SIGNED_IN' : 'SIGNED_OUT', s) };
}

const session = { user: { email: 'sam@example.com' } } as unknown as Session;

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const type = (placeholder: string, text: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: text } });

describe('page 1', () => {
  it('shows the approved layout', async () => {
    const { logins } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} />);
    expect(screen.getByText('Sign in with')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeTruthy();
    expect(screen.getByText('or')).toBeTruthy();
    expect(screen.getByText('Continue with other options')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email address')).toBeTruthy();
    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create an Account' })).toBeTruthy();
  });

  it("Continue does nothing until there's an email", () => {
    const { logins } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} />);
    press('Continue');
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it("a cancelled Apple sign-in shows nothing; a failed one shows Apple's message", async () => {
    const { logins, apple } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} />);
    press('Sign in with Apple');
    await waitFor(() => expect(apple.signIn).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(APPLE_MESSAGES.failed)).toBeNull();

    apple.signIn.mockResolvedValueOnce({ ok: false, cancelled: false, message: APPLE_MESSAGES.failed } as never);
    press('Sign in with Apple');
    expect(await screen.findByText(APPLE_MESSAGES.failed)).toBeTruthy();
  });

  it('says so when the app has no Supabase connection', async () => {
    render(<LoginFlow supabase={null} logins={{ email: null, apple: null, google: null }} />);
    press('Sign in with Google');
    expect(await screen.findByText(NOT_CONNECTED)).toBeTruthy();
  });

  it("shows the app's own logo when given one", () => {
    const { logins } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} logo={<span>My App</span>} />);
    expect(screen.getByText('My App')).toBeTruthy();
    expect(screen.queryByText('logo')).toBeNull();
  });
});

describe('page 2', () => {
  function toPage2() {
    const fakes = fakeLogins();
    render(<LoginFlow supabase={null} logins={fakes.logins} />);
    type('Email address', '  sam@example.com ');
    press('Continue');
    return fakes;
  }

  it('shows the email, the password box, Forgot password? and Log in', () => {
    toPage2();
    expect(screen.getByText('sam@example.com')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it("a wrong password shows the component's one message", async () => {
    const { email } = toPage2();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    press('Log in');
    expect(await screen.findByText(MESSAGES.signInFailed)).toBeTruthy();
    expect(email.signIn).toHaveBeenCalledWith('sam@example.com', 'wrong');
  });

  it('Show reveals the password and Hide covers it again', () => {
    toPage2();
    const box = screen.getByLabelText('Password') as HTMLInputElement;
    expect(box.type).toBe('password');
    press('Show password');
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).not.toBe('password');
    press('Hide password');
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password');
  });

  it('Back returns to page 1', () => {
    toPage2();
    press('‹ Back');
    expect(screen.getByText('Sign in with')).toBeTruthy();
  });
});

describe('forgot password', () => {
  it('fills in the email, sends the link, and shows the approved message', async () => {
    const { logins, email } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} />);
    type('Email address', 'sam@example.com');
    press('Continue');
    press('Forgot password?');

    expect(screen.getByText('Reset your password')).toBeTruthy();
    expect((screen.getByPlaceholderText('Email address') as HTMLInputElement).value).toBe('sam@example.com');

    press('Send reset link');
    expect(await screen.findByText(MESSAGES.resetSent)).toBeTruthy();
    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(email.requestPasswordReset).toHaveBeenCalledWith('sam@example.com');

    press('Back to Log in');
    expect(screen.getByText('Sign in with')).toBeTruthy();
  });

  it('lets the email be changed before sending', async () => {
    const { logins, email } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} />);
    type('Email address', 'sam@example.com');
    press('Continue');
    press('Forgot password?');
    type('Email address', 'other@example.com');
    press('Send reset link');
    await screen.findByText(MESSAGES.resetSent);
    expect(email.requestPasswordReset).toHaveBeenCalledWith('other@example.com');
  });
});

describe('create an account', () => {
  it('mirrors page 1, shows the password rules, and sends the confirm link', async () => {
    const { logins, email } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} />);
    press('Create an Account');

    expect(screen.getByText('Sign up with')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeTruthy();
    expect(screen.getByText(RULES)).toBeTruthy();

    type('Email address', 'new@example.com');
    type('Password', 'Abcdefgh1!');
    press('Create Account');

    expect(await screen.findByText("We've sent a link to confirm your account.")).toBeTruthy();
    expect(email.createAccount).toHaveBeenCalledWith('new@example.com', 'Abcdefgh1!');
  });

  it("a weak password shows the component's message", async () => {
    const { logins, email } = fakeLogins();
    email.createAccount.mockResolvedValueOnce({ ok: false, message: MESSAGES.weakPassword } as never);
    render(<LoginFlow supabase={null} logins={logins} />);
    press('Create an Account');
    type('Email address', 'new@example.com');
    type('Password', 'short');
    press('Create Account');
    expect(await screen.findByText(MESSAGES.weakPassword)).toBeTruthy();
  });
});

describe('email links', () => {
  it('a reset link opens Choose a new password, even though it logs the person in', async () => {
    const { logins, email } = fakeLogins();
    const supabase = fakeSupabase();
    // Like the real one: checking the link logs the person in before it answers.
    email.openEmailLink.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 10));
      supabase.emit(session);
      await new Promise((r) => setTimeout(r, 10));
      return { ok: true, kind: 'reset', session } as never;
    });
    render(<LoginFlow supabase={supabase.client} logins={logins} linkUrl="https://example.com/auth/reset?token_hash=abc&type=recovery" />);

    expect(await screen.findByText('Choose a new password')).toBeTruthy();
    expect(screen.getByText(RULES)).toBeTruthy();
    expect(screen.queryByText("You're logged in")).toBeNull();

    type('New password', 'Abcdefgh1!');
    press('Save password');
    supabase.emit(null);
    expect(await screen.findByText('Password changed')).toBeTruthy();
    expect(screen.getByText(MESSAGES.passwordChanged)).toBeTruthy();
    expect(email.setNewPassword).toHaveBeenCalledWith('Abcdefgh1!');

    press('Log in');
    expect(screen.getByText('Sign in with')).toBeTruthy();
  });

  it("a bad link shows the component's message on page 1", async () => {
    const { logins } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} linkUrl="https://example.com/auth/reset?token_hash=used&type=recovery" />);
    expect(await screen.findByText(MESSAGES.linkFailed)).toBeTruthy();
    expect(screen.getByText('Sign in with')).toBeTruthy();
  });

  it('ignores addresses that are not email links', () => {
    const { logins, email } = fakeLogins();
    render(<LoginFlow supabase={null} logins={logins} linkUrl="myapp://home" />);
    expect(email.openEmailLink).not.toHaveBeenCalled();
  });
});

describe('logged in', () => {
  it("shows the app's own page for a saved login", async () => {
    const { logins } = fakeLogins();
    const supabase = fakeSupabase(session);
    render(<LoginFlow supabase={supabase.client} logins={logins} signedIn={(s) => <span>Home for {s.user.email}</span>} />);
    expect(await screen.findByText('Home for sam@example.com')).toBeTruthy();
  });

  it('goes back to page 1 on logout', async () => {
    const { logins, email } = fakeLogins();
    const supabase = fakeSupabase(session);
    render(<LoginFlow supabase={supabase.client} logins={logins} />);
    expect(await screen.findByText("You're logged in")).toBeTruthy();
    press('Log out');
    expect(email.signOut).toHaveBeenCalled();
    supabase.emit(null);
    expect(await screen.findByText('Sign in with')).toBeTruthy();
  });
});
