import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import { Field } from '../parts/Field';
import { OrLine } from '../parts/OrLine';
import { ProviderButton } from '../parts/ProviderButton';
import { NOT_CONNECTED, type Logins } from '../logins';
import { theme } from '../theme';

/**
 * Page 1, as redesigned 2026-11-08: "Sign in with",
 * Google and Apple side by side with their logos, the "or" line, then "Continue
 * with other options", the email box and Continue.
 */
export function SignInStart({
  logins,
  logo,
  onContinue,
  onCreate,
}: {
  logins: Logins;
  /** The app's logo. Leave it out to show a grey placeholder. */
  logo?: ReactNode;
  onContinue: (email: string) => void;
  onCreate: () => void;
}) {
  const { apple, google } = logins;
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);

  async function continueWithApple() {
    if (!apple) return setNote(NOT_CONNECTED);
    const r = await apple.signIn();
    if (!r.ok && !r.cancelled) setNote(r.message);
  }

  async function continueWithGoogle() {
    if (!google) return setNote(NOT_CONNECTED);
    const r = await google.signIn();
    if (!r.ok && !r.cancelled) setNote(r.message);
  }

  return (
    <View style={styles.page}>
      {logo ?? (
        <View style={styles.logo}>
          <Text style={styles.logoText}>logo</Text>
        </View>
      )}

      <View style={styles.group}>
        <Text style={styles.heading}>Sign in with</Text>
        <View style={styles.row}>
          <ProviderButton provider="google" onPress={continueWithGoogle} />
          <ProviderButton provider="apple" onPress={continueWithApple} />
        </View>
      </View>

      <OrLine />

      <View style={styles.group}>
        <Text style={styles.heading}>Continue with other options</Text>
        <Field
          placeholder="Email address"
          value={email}
          onChangeText={(t) => { setEmail(t); setNote(null); }}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => email.trim() && onContinue(email.trim())}
        />
        <Button label="Continue" onPress={() => onContinue(email.trim())} disabled={!email.trim()} />
      </View>

      {note && <Text style={styles.note}>{note}</Text>}

      <View style={styles.footer}>
        <Text style={styles.muted}>Don't have an account?</Text>
        <Pressable accessibilityRole="button" onPress={onCreate}>
          <Text style={styles.link}>Create an Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.l },
  logo: {
    alignSelf: 'center',
    width: theme.space.xxl * 1.5,
    height: theme.space.xxl * 1.5,
    borderRadius: theme.radius * 1.5,
    backgroundColor: theme.color.box,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.s,
  },
  logoText: { color: theme.color.muted, fontSize: theme.type.small },
  group: { gap: theme.space.s },
  row: { flexDirection: 'row', gap: theme.space.s },
  heading: { fontSize: theme.type.body, color: theme.color.text, textAlign: 'center', marginBottom: theme.space.s / 2 },
  note: { color: theme.color.danger, fontSize: theme.type.small, textAlign: 'center' },
  footer: { alignItems: 'center', gap: theme.space.s / 2 },
  muted: { color: theme.color.muted, fontSize: theme.type.small },
  link: { color: theme.color.text, fontSize: theme.type.body, fontWeight: '600' },
});
