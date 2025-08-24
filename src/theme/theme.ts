import { useColorScheme } from 'react-native';

export type ThemeColors = {
  background: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  primaryText: string;
  secondary: string;
  chipBg: string;
  inputBg: string;
};

export function useThemeColors(): ThemeColors {
  const isDark = useColorScheme() === 'dark';
  if (isDark) {
    return {
      background: '#0b1212',
      card: '#11181a',
      border: '#1f2a2a',
      textPrimary: '#e6f6f6',
      textSecondary: '#9bb3b3',
      primary: '#00A3A3',
      primaryText: '#ffffff',
      secondary: '#6A3DE8',
      chipBg: '#0f1616',
      inputBg: '#0f1515',
    };
  }
  return {
    background: '#ffffff',
    card: '#f7f9fb',
    border: '#e5e7eb',
    textPrimary: '#0b1f1f',
    textSecondary: '#5b7070',
    primary: '#00A3A3',
    primaryText: '#ffffff',
    secondary: '#6A3DE8',
    chipBg: '#e6f7f7',
    inputBg: '#ffffff',
  };
}
