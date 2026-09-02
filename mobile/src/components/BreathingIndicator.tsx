import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

interface BreathingIndicatorProps {
  size?: number;
}

export function BreathingIndicator({ size = 48 }: BreathingIndicatorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.3,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('accessibility.loading_response')}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
          opacity: 0.8,
        }}
      />
    );
  }

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('accessibility.loading_response')}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}
