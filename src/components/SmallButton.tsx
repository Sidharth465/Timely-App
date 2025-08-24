import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/theme';

export function SmallButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
  theme?: any;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: theme.chipBg, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.text, { color: theme.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
