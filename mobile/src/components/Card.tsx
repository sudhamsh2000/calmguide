import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeContext';

export type CardVariant = 'default' | 'elevated' | 'interactive';

interface CardProps {
  variant?: CardVariant;
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
}

export function Card({ variant = 'default', children, style, onPress, padding = 16 }: CardProps) {
  const { colors } = useTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding,
    ...(variant === 'default' && {
      borderWidth: 1,
      borderColor: colors.border,
    }),
    ...(variant === 'elevated' && {
      boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
    }),
    ...(variant === 'interactive' && {
      borderWidth: 1,
      borderColor: colors.border,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }),
    ...style,
  };

  if (variant === 'interactive' && onPress) {
    return (
      <Pressable
        style={({ pressed }) => [baseStyle, pressed && { opacity: 0.75 }]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}
