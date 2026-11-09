import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Logins } from './logins';
import { SignInStart } from './screens/SignInStart';
import { SignInPassword } from './screens/SignInPassword';
import { SignedIn } from './screens/SignedIn';
import { CreateAccount } from './screens/CreateAccount';
import { CheckEmail } from './screens/CheckEmail';
import { ForgotPassword } from './screens/ForgotPassword';
import { ChooseNewPassword } from './screens/ChooseNewPassword';
import { theme } from './theme';

/**
 * Every sign-in page, in order, as one piece. It asks one question: is someone
 * logged in? Yes: the app's own page (`signedIn`). No: sign-in. One listener
 * hears every login and logout, so no page keeps its own copy of the answer.
 *
 * The app puts it inside its safe area, and passes the address of any link that
 * opened the app (`linkUrl`, for example from expo-linking's useURL()).
 */
export function LoginFlow({
  supabase,
  logins,
  linkUrl,
  signedIn,
  logo,
  startOn,
}: {
  supabase: SupabaseClient | null;
  logins: Logins;
  linkUrl?: string | null;
  signedIn?: (session: Session) => ReactNode;
  logo?: ReactNode;
  /** For previews only: open on "Choose a new password" without an email link. */
  startOn?: 'choose-password';
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(!!supabase);
  const [emailForPassword, setEmailForPassword] = useState<string | null>(null);
  const [signUp, setSignUp] = useState<'form' | 'sent' | null>(null);
  const [forgot, setForgot] = useState<{ email: string; sent: boolean } | null>(null);
  const [choosing, setChoosing] = useState(startOn === 'choose-password');
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [checkingLink, setCheckingLink] = useState(false);

  // An email link opened the app (or one of its pages): let the component check it.
  useEffect(() => {
    if (!linkUrl || !logins.email || !linkUrl.includes('token_hash=')) return;
    setCheckingLink(true);
    logins.email.openEmailLink(linkUrl).then((r) => {
      setCheckingLink(false);
      if (!r.ok) setLinkNote(r.message);
      else if (r.kind === 'reset') setChoosing(true);
      // A confirm link logs the person in; the listener below moves on by itself.
      // A reset link logs them in too, but they choose a new password first.
    });
  }, [linkUrl, logins.email]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const backToStart = () => {
    setChoosing(false);
    setForgot(null);
    setSignUp(null);
    setEmailForPassword(null);
  };

  let page;
  if (checking || checkingLink) page = <ActivityIndicator />;
  else if (session && !choosing) page = signedIn ? signedIn(session) : <SignedIn logins={logins} who={session.user.email ?? 'your account'} />;
  else if (choosing) page = <ChooseNewPassword logins={logins} onDone={backToStart} />;
  else if (forgot?.sent) page = <CheckEmail after="reset" onBack={backToStart} />;
  else if (forgot) page = <ForgotPassword logins={logins} email={forgot.email} onBack={() => setForgot(null)} onSent={() => setForgot({ ...forgot, sent: true })} />;
  else if (signUp === 'sent') page = <CheckEmail after="create" onBack={backToStart} />;
  else if (signUp === 'form') page = <CreateAccount logins={logins} onBack={() => setSignUp(null)} onSent={() => setSignUp('sent')} />;
  else if (emailForPassword) page = <SignInPassword logins={logins} email={emailForPassword} onBack={() => setEmailForPassword(null)} onForgot={() => setForgot({ email: emailForPassword, sent: false })} />;
  else page = <SignInStart logins={logins} logo={logo} onContinue={setEmailForPassword} onCreate={() => setSignUp('form')} />;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {linkNote && <Text style={styles.linkNote}>{linkNote}</Text>}
          {page}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: theme.space.l },
  column: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  linkNote: { color: theme.color.danger, fontSize: theme.type.small, textAlign: 'center', marginBottom: theme.space.l },
});
