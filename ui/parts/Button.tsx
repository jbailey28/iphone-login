import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';

/** A full-width button. */
export function Button({
  label,
  onPress,
  kind = 'solid',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'solid' | 'outline';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const solid = kind === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        solid ? styles.solid : styles.outline,
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: solid ? theme.color.actionText : theme.color.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: theme.control,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.m,
  },
  solid: { backgroundColor: theme.color.action },
  outline: { backgroundColor: theme.color.background, borderWidth: 1, borderColor: theme.color.line },
  label: { fontSize: theme.type.body, fontWeight: '600' },
});
