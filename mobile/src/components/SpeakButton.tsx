import React, { useCallback } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/ThemeContext";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import Svg, { Polygon, Path, Rect } from "react-native-svg";

interface SpeakButtonProps {
  text: string;
}

function SpeakButtonComponent({ text }: SpeakButtonProps) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('common');
  const { speak, stop, isSpeaking } = useSpeechSynthesis({ locale: i18n.language });

  const handlePress = useCallback(() => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  }, [isSpeaking, stop, speak, text]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={isSpeaking ? t('accessibility.stop_reading') : t('accessibility.read_aloud')}
      accessibilityRole="button"
      style={[
        styles.button,
        { backgroundColor: isSpeaking ? colors.primary + "20" : colors.foreground + "10" },
      ]}
    >
      {isSpeaking ? (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill={colors.primary}>
          <Rect x={6} y={4} width={4} height={16} rx={1} />
          <Rect x={14} y={4} width={4} height={16} rx={1} />
        </Svg>
      ) : (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2}>
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </Svg>
      )}
    </Pressable>
  );
}

/**
 * Memoized so streaming flushes on the coach screen don't re-render every
 * SpeakButton when its `text` prop is unchanged (MOBPERF-14).
 */
export const SpeakButton = React.memo(SpeakButtonComponent);

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
