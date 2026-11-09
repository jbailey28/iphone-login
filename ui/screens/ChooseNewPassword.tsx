import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import { Field } from '../parts/Field';
import { NOT_CONNECTED, type Logins } from '../logins';
import { theme } from '../theme';

/**
 * Opened from the "Reset your password" email's link (after the component has
 * checked the link). Saving logs every device out, so the person logs in again.
 */
export function ChooseNewPassword({ logins, onDone }: { logins: Logins; onDone: () => void }) {
  const emailLogin = logins.email;
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!emailLogin) return setNote(NOT_CONNECTED);
    setBusy(true);
    const r = await emailLogin.setNewPassword(password);
    setBusy(false);
    if (r.ok) setDone(r.message ?? 'Your password was changed.');
    else setNote(r.message);
  }

  if (done) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Password changed</Text>
        <Text style={styles.body}>{done}</Text>
        <Button label="Log in" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Choose a new password</Text>
      <View style={{ gap: theme.space.s }}>
        <Field
          placeholder="New password"
          secret
          value={password}
          onChangeText={(t) => { setPassword(t); setNote(null); }}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={save}
          autoFocus
        />
        <Text style={styles.rules}>
          At least 10 characters, including an uppercase letter, a lowercase letter, a number, and a special character.
        </Text>
        <Button label={busy ? 'Saving…' : 'Save password'} onPress={save} disabled={!password || busy} />
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.l },
  title: { fontSize: theme.type.title, fontWeight: '700', color: theme.color.text, textAlign: 'center' },
  body: { fontSize: theme.type.body, color: theme.color.muted, textAlign: 'center' },
  rules: { fontSize: theme.type.small, color: theme.color.muted },
  note: { color: theme.color.danger, fontSize: theme.type.small, textAlign: 'center' },
});
