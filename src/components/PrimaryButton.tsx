import React from 'react';
import { Pressable, Text, Platform, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '../theme/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: disabled ? '#94a3b8' : theme.primary,
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: theme.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    ...Platform.select({ android: { elevation: 2 } }),
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
