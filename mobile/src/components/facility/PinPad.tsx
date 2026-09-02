import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Button } from '../Button';

interface PinPadProps {
  onComplete: (pin: string) => void;
  error?: string | null;
  disabled?: boolean;
  maxLength?: number;
  locked?: boolean;
  onBackToSelect?: () => void;
}

const PIN_LENGTH = 4;

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
] as const;

export function PinPad({
  onComplete,
  error,
  disabled = false,
  maxLength = PIN_LENGTH,
  locked = false,
  onBackToSelect,
}: PinPadProps) {
  const { colors } = useTheme();
  const [digits, setDigits] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      setDigits('');
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [error, shakeAnim]);

  const handlePress = useCallback(
    (key: string) => {
      if (disabled) return;

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (key === 'del') {
        setDigits((prev) => prev.slice(0, -1));
        return;
      }

      setDigits((prev) => {
        const next = prev + key;
        if (next.length >= maxLength) {
          setTimeout(() => {
            onComplete(next);
            setDigits('');
          }, 150);
        }
        return next.length <= maxLength ? next : prev;
      });
    },
    [disabled, maxLength, onComplete],
  );

  const dotRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  };

  if (locked) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
        <Text style={{ fontSize: 48 }}>{'🔒'}</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.error, textAlign: 'center' }}>
          Account temporarily locked
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.mutedForeground,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          Contact your charge nurse to reset
        </Text>
        {onBackToSelect && (
          <Button variant="secondary" onPress={onBackToSelect} style={{ marginTop: 8 }}>
            Back to staff selection
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
      <Animated.View
        style={[dotRow, { transform: [{ translateX: shakeAnim }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: i < digits.length ? colors.primary : 'transparent',
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          />
        ))}
      </Animated.View>

      {error ? (
        <Text
          style={{
            color: colors.error,
            fontSize: 14,
            fontWeight: '500',
            marginTop: 4,
            marginBottom: 8,
            textAlign: 'center',
          }}
          accessibilityLiveRegion="assertive"
        >
          {error}
        </Text>
      ) : (
        <View style={{ height: 30 }} />
      )}

      <View style={{ gap: 12 }}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
            {row.map((key) => {
              if (key === '') {
                return <View key="empty" style={{ width: 80, height: 80 }} />;
              }

              const isDel = key === 'del';
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePress(key)}
                  disabled={disabled || (isDel && digits.length === 0)}
                  accessibilityRole="button"
                  accessibilityLabel={isDel ? 'Delete' : key}
                  style={({ pressed }) => ({
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: isDel
                      ? 'transparent'
                      : pressed
                        ? colors.primary
                        : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isDel ? 0 : 1,
                    borderColor: colors.border,
                    opacity: disabled ? 0.4 : 1,
                  })}
                >
                  {({ pressed }) => (
                    <Text
                      style={{
                        fontSize: isDel ? 20 : 28,
                        fontWeight: '600',
                        color: isDel
                          ? colors.mutedForeground
                          : pressed
                            ? '#FFFFFF'
                            : colors.foreground,
                      }}
                    >
                      {isDel ? '⌫' : key}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
