import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '../theme';

/** A labelled text box. `secret` adds the show/hide eye for passwords. */
/** `label` sits above the box; leave it out and use `placeholder` for a box with its name inside. */
export function Field({ label, secret, ...input }: { label?: string; secret?: boolean } & TextInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: theme.space.s }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.box}>
        <TextInput
          style={styles.input}
          placeholderTextColor={theme.color.muted}
          secureTextEntry={secret && !shown}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label ?? input.placeholder}
          {...input}
        />
        {secret && (
          <Pressable
            onPress={() => setShown((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            hitSlop={theme.space.s}
          >
            <Text style={styles.eye}>{shown ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: theme.type.small, color: theme.color.muted },
  box: {
    height: theme.control,
    borderRadius: theme.radius,
    backgroundColor: theme.color.box,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.m,
    gap: theme.space.s,
  },
  input: {
    flex: 1,
    fontSize: theme.type.body,
    color: theme.color.text,
    height: '100%',
    // The web preview draws its own focus ring inside the box; iPhones don't.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  eye: { fontSize: theme.type.small, color: theme.color.muted, fontWeight: '600' },
});
