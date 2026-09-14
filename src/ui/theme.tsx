import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useAppSelector } from '../store/store';

const light = {
  bg: '#F8F8F2',
  surface: '#FFFFFF',
  ink: '#24382E',
  muted: '#69786F',
  line: '#E5E9E0',
  green: '#2D634B',
  soft: '#EDF2E7',
  lime: '#D9EF9E',
  peach: '#F9EBDD',
  danger: '#A43D36',
  hero: '#214B3A',
  heroText: '#FAFCEE',
  shadow: '#183124',
};
type Palette = typeof light;
const dark: Palette = {
  bg: '#111D17',
  surface: '#1B2A21',
  ink: '#F0F3E8',
  muted: '#A7B8AA',
  line: '#334537',
  green: '#BDDB99',
  soft: '#293D2D',
  lime: '#D9EF9E',
  peach: '#44392D',
  danger: '#FFB4A9',
  hero: '#214B3A',
  heroText: '#FAFCEE',
  shadow: '#000000',
};
const ThemeContext = createContext({ colors: light, isDark: false });
export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useAppSelector((state) => state.data.preferences.theme);
  const system = useColorScheme();
  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');
  return (
    <ThemeContext.Provider value={{ colors: isDark ? dark : light, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
