import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../parts/Button';
import type { Logins } from '../logins';
import { theme } from '../theme';

/**
 * A plain logged-in page, shown when the app gives LoginFlow no page of its own.
 * Close the app fully and reopen: it should still be here.
 */
export function SignedIn({ logins, who }: { logins: Logins; who: string }) {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>You're logged in</Text>
      <Text style={styles.muted}>{who}</Text>
      <Button label="Log out" kind="outline" onPress={() => logins.email?.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.space.m },
  title: { fontSize: theme.type.title, fontWeight: '700', color: theme.color.text },
  muted: { fontSize: theme.type.body, color: theme.color.muted, marginBottom: theme.space.m },
});
