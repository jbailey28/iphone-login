import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import { Field } from '../parts/Field';
import { OrLine } from '../parts/OrLine';
import { ProviderButton } from '../parts/ProviderButton';
import { NOT_CONNECTED, type Logins } from '../logins';
import { theme } from '../theme';

/**
 * Create an Account, as designed 2026-11-09: mirrors page 1 (Google and Apple
 * side by side, then "or"), then email, password with its rules, and Create
 * Account. Apple and Google create an account automatically the first time.
 */
export function CreateAccount({ logins, onBack, onSent }: { logins: Logins; onBack: () => void; onSent: () => void }) {
  const { email: emailLogin, apple, google } = logins;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function withApple() {
    if (!apple) return setNote(NOT_CONNECTED);
    const r = await apple.signIn();
    if (!r.ok && !r.cancelled) setNote(r.message);
  }

  async function withGoogle() {
    if (!google) return setNote(NOT_CONNECTED);
    const r = await google.signIn();
    if (!r.ok && !r.cancelled) setNote(r.message);
  }

  async function create() {
    if (!emailLogin) return setNote(NOT_CONNECTED);
    setBusy(true);
    const r = await emailLogin.createAccount(email.trim(), password);
    setBusy(false);
    if (r.ok) onSent();
    else setNote(r.message);
  }

  return (
    <View style={styles.page}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={theme.space.s}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>Create an Account</Text>

      <View style={styles.group}>
        <Text style={styles.heading}>Sign up with</Text>
        <View style={styles.row}>
          <ProviderButton provider="google" onPress={withGoogle} />
          <ProviderButton provider="apple" onPress={withApple} />
        </View>
      </View>

      <OrLine />

      <View style={styles.group}>
        <Field
          placeholder="Email address"
          value={email}
          onChangeText={(t) => { setEmail(t); setNote(null); }}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          placeholder="Password"
          secret
          value={password}
          onChangeText={(t) => { setPassword(t); setNote(null); }}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={create}
        />
        <Text style={styles.rules}>
          At least 10 characters, including an uppercase letter, a lowercase letter, a number, and a special character.
        </Text>
        <Button
          label={busy ? 'Creating…' : 'Create Account'}
          onPress={create}
          disabled={!email.trim() || !password || busy}
        />
      </View>

      {note && <Text style={styles.note}>{note}</Text>}

      <View style={styles.footer}>
        <Text style={styles.muted}>Already have an account?</Text>
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text style={styles.link}>Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.l },
  back: { fontSize: theme.type.body, color: theme.color.text },
  title: { fontSize: theme.type.title, fontWeight: '700', color: theme.color.text, textAlign: 'center' },
  group: { gap: theme.space.s },
  row: { flexDirection: 'row', gap: theme.space.s },
  heading: { fontSize: theme.type.body, color: theme.color.text, textAlign: 'center', marginBottom: theme.space.s / 2 },
  rules: { fontSize: theme.type.small, color: theme.color.muted },
  note: { color: theme.color.danger, fontSize: theme.type.small, textAlign: 'center' },
  footer: { alignItems: 'center', gap: theme.space.s / 2 },
  muted: { color: theme.color.muted, fontSize: theme.type.small },
  link: { color: theme.color.text, fontSize: theme.type.body, fontWeight: '600' },
});
