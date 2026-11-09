import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/** ─────── or ─────── */
export function OrLine() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.or}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.m },
  line: { flex: 1, height: 1, backgroundColor: theme.color.line },
  or: { fontSize: theme.type.small, color: theme.color.muted },
});
