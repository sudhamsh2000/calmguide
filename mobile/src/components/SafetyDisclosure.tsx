import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

/**
 * Emergency numbers for the locales the app ships in.
 *
 * Keyed by bare language code and looked up via localeNumbers() below, which
 * normalises first. i18n.language is a full tag ("es-ES", "hi-IN"), so indexing
 * this map with it directly missed every time and silently fell back to the
 * English entry — every Spanish and Hindi caregiver was shown US 911 and the US
 * helpline. That is the bug the normalisation exists to prevent.
 *
 * The backend keeps a wider map (app/services/safety_gate.py) because browser
 * traffic can arrive with any Accept-Language and emergency numbers are a
 * matter of geography, not of which language we answer in. The app has no such
 * signal — its locale is only ever one of these three.
 */
const EMERGENCY_NUMBERS: Record<
  string,
  { emergency: string; helpline: string; helplineName: string }
> = {
  en: {
    emergency: '911',
    helpline: '1-800-272-3900',
    helplineName: "Alzheimer's Association 24/7 Helpline",
  },
  es: {
    emergency: '911',
    helpline: '1-800-272-3900',
    helplineName: 'Línea de Ayuda de Alzheimer 24/7',
  },
  hi: { emergency: '112', helpline: '1800-11-0031', helplineName: 'ARDSI हेल्पलाइन' },
};

/** Resolve numbers for a full locale tag, falling back to English. */
function localeNumbers(locale: string | undefined) {
  const base = (locale ?? 'en').toLowerCase().split('-', 1)[0];
  return EMERGENCY_NUMBERS[base] ?? EMERGENCY_NUMBERS.en;
}
export function SafetyDisclosure() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('coach');
  const [expanded, setExpanded] = useState(false);
  const numbers = localeNumbers(i18n.language);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.warning + '66',
        backgroundColor: colors.warning + '22',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${t('safety_disclosure.safety_headline')} ${t('safety_disclosure.safety_call_emergency', { number: numbers.emergency })}`}
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text aria-hidden style={{ fontSize: 13 }}>
          ⓘ
        </Text>
        <Text style={{ flex: 1, fontSize: 14, color: colors.foreground, lineHeight: 18 }}>
          <Text style={{ fontWeight: '700' }}>{t('safety_disclosure.safety_headline')}</Text>{' '}
          {t('safety_disclosure.safety_call_emergency', { number: numbers.emergency })}
        </Text>
        <Text
          style={{ fontSize: 14, color: colors.mutedForeground, textDecorationLine: 'underline' }}
        >
          {expanded ? t('safety_disclosure.safety_hide') : t('safety_disclosure.safety_info')}
        </Text>
      </Pressable>
      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.warning + '66',
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 18 }}>
            {t('honesty_disclaimer')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 18 }}>
            <Text style={{ fontWeight: '700' }}>{t('safety_disclosure.safety_talking_to_ai')}</Text>{' '}
            {t('safety_disclosure.safety_emergency_instruction', { number: numbers.emergency })}{' '}
            <Text
              onPress={() =>
                Linking.openURL(`tel:${numbers.helpline.replace(/[^+\d]/g, '')}`).catch(() => {})
              }
              accessibilityRole="link"
              accessibilityLabel={`Call ${numbers.helplineName} at ${numbers.helpline}`}
              style={{ fontWeight: '700', color: colors.accent, textDecorationLine: 'underline' }}
            >
              {t('safety_disclosure.safety_helpline', {
                phone: numbers.helpline,
                name: numbers.helplineName,
              })}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}
