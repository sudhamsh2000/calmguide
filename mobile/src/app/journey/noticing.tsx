import { DeflectionLayout } from '@/components/DeflectionLayout';
import { useTheme } from '@/components/ThemeContext';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function NoticingScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('journey');
  const p = { fontSize: 15, color: colors.foreground, lineHeight: 23 };

  const resources = [
    {
      label: t('noticing.resources.ten_signs_label'),
      href: 'https://www.alz.org/alzheimers-dementia/10_signs',
      description: t('noticing.resources.ten_signs_desc'),
    },
    {
      label: t('noticing.resources.doctor_label'),
      href: 'https://www.alz.org/alzheimers-dementia/diagnosis/visiting-your-doctor',
      description: t('noticing.resources.doctor_desc'),
    },
    {
      label: t('noticing.resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('noticing.resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('noticing.resources.nia_label'),
      href: 'https://www.nia.nih.gov/health/alzheimers-and-dementia/what-dementia-symptoms-types-and-diagnosis',
      description: t('noticing.resources.nia_desc'),
    },
  ];

  return (
    <DeflectionLayout
      title={t('noticing.title')}
      subtitle={t('noticing.subtitle')}
      resources={resources}
      resourcesHeading={t('trusted_resources')}
      body={
        <>
          <Text style={p}>
            {t('noticing.p1_lead')}{' '}
            <Text style={{ fontWeight: '700' }}>{t('noticing.p1_emph')}</Text>
          </Text>
          <Text style={p}>{t('noticing.p2')}</Text>
          <Text style={p}>{t('noticing.p3')}</Text>
          <Text
            style={{ ...p, fontSize: 13, fontStyle: 'italic', color: colors.mutedForeground }}
          >
            {t('noticing.footnote')}
          </Text>
        </>
      }
    />
  );
}
