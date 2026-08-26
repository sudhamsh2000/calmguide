import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { useTheme } from './ThemeContext';
import { getDisclaimerAccepted, setDisclaimerAccepted } from '@/lib/storage';

export function MedicalDisclaimer({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    getDisclaimerAccepted().then(setAccepted);
  }, []);

  if (accepted === null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (accepted) return <>{children}</>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        paddingTop: 24 + insets.top,
        paddingBottom: 24 + insets.bottom,
      }}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 22,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
          {t('disclaimer.title')}
        </Text>

        <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
          {t('disclaimer.lead_a')}{' '}
          <Text style={{ fontWeight: '700' }}>{t('disclaimer.lead_a_emph')}</Text>
          {t('disclaimer.lead_a_tail')} {t('disclaimer.lead_b')}{' '}
          <Text style={{ fontWeight: '700' }}>{t('disclaimer.lead_b_emph')}</Text>
          {t('disclaimer.lead_b_tail')}
        </Text>

        <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
          {t('disclaimer.no_diagnosis')}
        </Text>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, color: colors.foreground }}>
            • {t('disclaimer.bullet_emergency')} <Text style={{ fontWeight: '700' }}>911</Text>
          </Text>
          <Text style={{ fontSize: 15, color: colors.foreground }}>
            • {t('disclaimer.bullet_doctor')}
          </Text>
          <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
            • {t('disclaimer.bullet_helpline_lead')}{' '}
            <Text style={{ fontWeight: '700' }}>{t('disclaimer.bullet_helpline_emph')}</Text>{' '}
            {t('disclaimer.bullet_helpline_at')}{' '}
            <Text
              onPress={() => Linking.openURL('tel:18002723900').catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel="Call Alzheimer's Association at 1-800-272-3900"
              style={{ fontWeight: '700', color: colors.primary, textDecorationLine: 'underline' }}
            >
              1-800-272-3900
            </Text>
          </Text>
        </View>

        <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
          {t('disclaimer.ack')}
        </Text>

        <Button
          size="lg"
          variant="primary"
          onPress={async () => {
            await setDisclaimerAccepted();
            setAccepted(true);
          }}
          style={{ minHeight: 52 }}
        >
          {t('disclaimer.cta')}
        </Button>
      </View>
    </ScrollView>
  );
}
