import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

function SunIcon({ color, size }: { color: string; size: number }) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const coreR = r * 0.35;
  const rayLen = r * 0.18;
  const rayStart = coreR + r * 0.08;
  const rayEnd = rayStart + rayLen;

  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    return {
      x1: cx + Math.cos(angle) * rayStart,
      y1: cy + Math.sin(angle) * rayStart,
      x2: cx + Math.cos(angle) * rayEnd,
      y2: cy + Math.sin(angle) * rayEnd,
    };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={coreR} fill={color} />
      {rays.map((ray, i) => (
        <Line
          key={i}
          x1={ray.x1}
          y1={ray.y1}
          x2={ray.x2}
          y2={ray.y2}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

function MoonIcon({ color, size }: { color: string; size: number }) {
  const d = size;
  return (
    <Svg width={d} height={d} viewBox="0 0 24 24">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ThemeToggle() {
  const { isDark, setThemePreference, colors } = useTheme();
  const { t } = useTranslation('common');

  function toggle() {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setThemePreference(isDark ? 'light' : 'dark');
  }

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDark ? colors.surface : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={isDark ? t('accessibility.switch_light') : t('accessibility.switch_dark')}
    >
      {isDark ? (
        <SunIcon color={colors.foreground} size={18} />
      ) : (
        <MoonIcon color={colors.foreground} size={18} />
      )}
    </Pressable>
  );
}
