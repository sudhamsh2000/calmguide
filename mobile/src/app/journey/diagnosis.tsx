import { DeflectionLayout } from '@/components/DeflectionLayout';
import { useTheme } from '@/components/ThemeContext';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function DiagnosisScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('journey');
  const p = { fontSize: 15, color: colors.foreground, lineHeight: 23 };

  const resources = [
    {
      label: t('diagnosis.resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('diagnosis.resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('diagnosis.resources.support_label'),
      href: 'https://www.alz.org/help-support/community/support-groups',
      description: t('diagnosis.resources.support_desc'),
    },
    {
      label: t('diagnosis.resources.after_label'),
      href: 'https://www.alz.org/alzheimers-dementia/diagnosis/life-after-diagnosis',
      description: t('diagnosis.resources.after_desc'),
    },
    {
      label: t('diagnosis.resources.can_label'),
      href: 'https://www.caregiveraction.org/',
      description: t('diagnosis.resources.can_desc'),
    },
  ];

  return (
    <DeflectionLayout
      title={t('diagnosis.title')}
      subtitle={t('diagnosis.subtitle')}
      resources={resources}
      resourcesHeading={t('trusted_resources')}
      body={
        <>
          <Text style={p}>{t('diagnosis.p1')}</Text>
          <Text style={p}>
            <Text style={{ fontWeight: '700' }}>{t('diagnosis.p2_emph')}</Text>{' '}
            {t('diagnosis.p2_tail')}
          </Text>
          <Text style={p}>{t('diagnosis.p3')}</Text>
          <Text style={p}>{t('diagnosis.p4')}</Text>
        </>
      }
    />
  );
}
