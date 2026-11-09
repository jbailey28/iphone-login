import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import { Field } from '../parts/Field';
import { NOT_CONNECTED, type Logins } from '../logins';
import { theme } from '../theme';

/** Page 2, as designed 2026-11-06: the password, Forgot password?, and Log in. */
export function SignInPassword({
  logins,
  email,
  onBack,
  onForgot,
}: {
  logins: Logins;
  email: string;
  onBack: () => void;
  onForgot: () => void;
}) {
  const emailLogin = logins.email;
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logIn() {
    if (!emailLogin) return setNote(NOT_CONNECTED);
    setBusy(true);
    const r = await emailLogin.signIn(email, password);
    setBusy(false);
    // On success the front door sees the new login and moves on by itself.
    if (!r.ok) setNote(r.message);
  }

  return (
    <View style={styles.page}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={theme.space.s}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.email}>{email}</Text>

      <View style={{ gap: theme.space.s }}>
        <Field
          label="Password"
          secret
          value={password}
          onChangeText={(t) => { setPassword(t); setNote(null); }}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={logIn}
          autoFocus
        />
        <Pressable
          accessibilityRole="button"
          style={styles.forgot}
          onPress={onForgot}
        >
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      </View>

      <Button label={busy ? 'Logging in…' : 'Log in'} onPress={logIn} disabled={!password || busy} />

      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.l },
  back: { fontSize: theme.type.body, color: theme.color.text },
  email: { fontSize: theme.type.body, color: theme.color.muted },
  forgot: { alignSelf: 'flex-end' },
  link: { fontSize: theme.type.small, color: theme.color.text, fontWeight: '600' },
  note: { color: theme.color.danger, fontSize: theme.type.small, textAlign: 'center' },
});
