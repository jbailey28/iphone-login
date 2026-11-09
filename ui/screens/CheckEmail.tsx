import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import { MESSAGES } from '../../src/emailLogin';
import { theme } from '../theme';

/**
 * "Check your email", after Create Account or Send reset link. The words are
 * the component's own, approved 2026-11-08.
 */
export function CheckEmail({ after, onBack }: { after: 'create' | 'reset'; onBack: () => void }) {
  const body = after === 'create' ? MESSAGES.confirmSent.replace(/^Check your email\.\s*/, '') : MESSAGES.resetSent;
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>{body}</Text>
      <Button label="Back to Log in" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.l },
  title: { fontSize: theme.type.title, fontWeight: '700', color: theme.color.text, textAlign: 'center' },
  body: { fontSize: theme.type.body, color: theme.color.muted, textAlign: 'center' },
});
