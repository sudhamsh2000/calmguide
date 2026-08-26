import React, { useState } from 'react';
import { I18nManager, Text, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from './ThemeContext';

interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  inputStyle?: TextInputProps['style'];
}

export function ThemedInput({ label, error, inputStyle, ...props }: ThemedInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.foreground,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 17,
            color: colors.foreground,
            minHeight: 50,
            textAlign: I18nManager.isRTL ? 'right' : 'left',
            writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
          },
          inputStyle,
        ]}
        placeholderTextColor={colors.mutedForeground}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error ? (
        <Text style={{ fontSize: 13, color: colors.error }}>{error}</Text>
      ) : null}
    </View>
  );
}
