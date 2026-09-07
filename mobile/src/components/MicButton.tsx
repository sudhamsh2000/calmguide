import { useCallback, useEffect } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import Svg, { Path, Line } from 'react-native-svg';

interface MicButtonProps {
  onTranscript: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  /**
   * Fires once recognition has actually finished — after any trailing final
   * `onTranscript` for the last utterance. Wire this to a submit handler to
   * auto-submit when the caregiver stops speaking, matching the web MicButton
   * (frontend/src/components/ui/MicButton.tsx).
   */
  onSpeechEnd?: () => void;
  disabled?: boolean;
  transparent?: boolean;
}

export function MicButton({
  onTranscript,
  onListeningChange,
  onSpeechEnd,
  disabled = false,
  transparent = false,
}: MicButtonProps) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('common');

  const handleError = useCallback(
    (code: string) => {
      // Mapped to what the caregiver can actually do about it, not the raw
      // platform error code. 'no-speech' / 'speech-timeout' invite a retry;
      // everything else (denied permission, no recognizer on the device, no
      // network, a busy service) all land on the same place — type instead —
      // because there's no in-app remedy for any of them.
      const key =
        code === 'not-allowed'
          ? 'not_allowed'
          : code === 'service-not-allowed' || code === 'audio-capture'
            ? 'not_available'
            : code === 'no-speech' || code === 'speech-timeout'
              ? 'no_speech'
              : code === 'network'
                ? 'network'
                : 'generic';
      Alert.alert(t('accessibility.voice_input'), t(`voice_error.${key}`));
    },
    [t],
  );

  const { start, stop, isListening, isSupported } = useSpeechRecognition({
    locale: i18n.language,
    onResult: onTranscript,
    onError: handleError,
    onEnd: onSpeechEnd,
  });

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  if (!isSupported) return null;

  const handlePress = () => {
    if (isListening) {
      stop();
      AccessibilityInfo.announceForAccessibility(t('accessibility.voice_stopped'));
    } else {
      start();
      AccessibilityInfo.announceForAccessibility(t('accessibility.listening'));
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={
        isListening ? t('accessibility.stop_voice') : t('accessibility.voice_input')
      }
      accessibilityRole="button"
      accessibilityState={{ selected: isListening }}
      style={[
        styles.button,
        {
          backgroundColor: isListening
            ? colors.error + '14'
            : transparent
              ? 'transparent'
              : colors.foreground + '10',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke={isListening ? colors.error : colors.mutedForeground}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <Line x1={12} y1={19} x2={12} y2={23} />
        <Line x1={8} y1={23} x2={16} y2={23} />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
