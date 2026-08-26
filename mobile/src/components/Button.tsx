import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const sizeHeights: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const sizePaddings: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 20 };
const sizeFonts: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    minHeight: sizeHeights[size],
    paddingHorizontal: sizePaddings[size],
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minWidth: 0,
    gap: 8,
    ...(variant === 'primary' && {
      backgroundColor: isDisabled ? colors.primary + '73' : colors.primary,
    }),
    ...(variant === 'secondary' && {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: isDisabled ? colors.primary + '55' : colors.primary,
    }),
    ...(variant === 'danger' && {
      backgroundColor: isDisabled ? colors.error + '73' : colors.error,
    }),
    ...(variant === 'ghost' && {
      backgroundColor: 'transparent',
    }),
    ...style,
  };

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'secondary'
        ? isDisabled ? colors.primary + 'AA' : colors.primary
        : isDisabled ? colors.mutedForeground + 'CC' : colors.mutedForeground;

  const handlePress = () => {
    if (isDisabled) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  return (
    <Pressable
      style={({ pressed }) => [containerStyle, pressed && !isDisabled && { opacity: 0.8 }]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={{
            color: textColor,
            fontSize: sizeFonts[size],
            fontWeight: '600',
            textAlign: 'center',
            flexShrink: 1,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.88}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
