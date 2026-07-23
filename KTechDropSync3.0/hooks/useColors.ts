import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

type ColorScheme = typeof colors.light;

export function useColors(): ColorScheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? colors.dark : colors.light;
}
