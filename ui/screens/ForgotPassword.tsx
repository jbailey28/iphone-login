import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import { Field } from '../parts/Field';
import { NOT_CONNECTED, type Logins } from '../logins';
import { theme } from '../theme';

/** Reset your password, as designed 2026-11-09: the email is already filled in and can be changed. */
export function ForgotPassword({
  logins,
  email: start,
  onBack,
  onSent,
}: {
  logins: Logins;
  email: string;
  onBack: () => void;
  onSent: () => void;
}) {
  const emailLogin = logins.email;
  const [email, setEmail] = useState(start);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!emailLogin) return setNote(NOT_CONNECTED);
    setBusy(true);
    const r = await emailLogin.requestPasswordReset(email.trim());
    setBusy(false);
    if (r.ok) onSent();
    else setNote(r.message);
  }

  return (
    <View style={styles.page}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={theme.space.s}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.body}>Enter your email and we'll send you a link to choose a new password.</Text>
      <View style={{ gap: theme.space.s }}>
        <Field
          placeholder="Email address"
          value={email}
          onChangeText={(t) => { setEmail(t); setNote(null); }}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Button label={busy ? 'Sending…' : 'Send reset link'} onPress={send} disabled={!email.trim() || busy} />
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
      <Pressable accessibilityRole="button" onPress={onBack} style={{ alignSelf: 'center' }}>
        <Text style={styles.link}>Back to Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.l },
  back: { fontSize: theme.type.body, color: theme.color.text },
  title: { fontSize: theme.type.title, fontWeight: '700', color: theme.color.text, textAlign: 'center' },
  body: { fontSize: theme.type.body, color: theme.color.muted, textAlign: 'center' },
  note: { color: theme.color.danger, fontSize: theme.type.small, textAlign: 'center' },
  link: { color: theme.color.text, fontSize: theme.type.body, fontWeight: '600' },
});
