import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

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
  fr: { emergency: '15', helpline: '01 42 04 28 50', helplineName: 'France Alzheimer' },
  de: {
    emergency: '112',
    helpline: '030 259 37 95 14',
    helplineName: 'Deutsche Alzheimer Gesellschaft',
  },
  'pt-BR': { emergency: '192', helpline: '0800-272-3900', helplineName: 'ABRAz' },
  ja: { emergency: '119', helpline: '0120-279-338', helplineName: '認知症の人と家族の会' },
  ko: { emergency: '119', helpline: '1899-9988', helplineName: '치매상담콜센터' },
  zh: { emergency: '120', helpline: '400-610-0020', helplineName: '中国阿尔茨海默病协会' },
  hi: { emergency: '112', helpline: '1800-11-0031', helplineName: 'ARDSI हेल्पलाइन' },
  ta: { emergency: '112', helpline: '1800-11-0031', helplineName: 'ARDSI உதவி எண்' },
  ar: { emergency: '911', helpline: '920033360', helplineName: 'خط مساعدة الزهايمر' },
};

export function SafetyDisclosure() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('coach');
  const [expanded, setExpanded] = useState(false);
  const numbers = EMERGENCY_NUMBERS[i18n.language] || EMERGENCY_NUMBERS.en;

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
              style={{ fontWeight: '700', color: colors.primary, textDecorationLine: 'underline' }}
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
