import { DeflectionLayout } from '@/components/DeflectionLayout';
import { useTheme } from '@/components/ThemeContext';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function HospiceScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('journey');
  const p = { fontSize: 15, color: colors.foreground, lineHeight: 23 };

  const resources = [
    {
      label: t('hospice.resources.hfa_label'),
      href: 'https://hospicefoundation.org/',
      description: t('hospice.resources.hfa_desc'),
    },
    {
      label: t('hospice.resources.alz_late_label'),
      href: 'https://www.alz.org/help-support/caregiving/stages-behaviors/late-stage',
      description: t('hospice.resources.alz_late_desc'),
    },
    {
      label: t('hospice.resources.nhpco_label'),
      href: 'https://www.nhpco.org/',
      description: t('hospice.resources.nhpco_desc'),
    },
    {
      label: t('hospice.resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('hospice.resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('hospice.resources.nia_label'),
      href: 'https://www.nia.nih.gov/health/end-life',
      description: t('hospice.resources.nia_desc'),
    },
  ];

  return (
    <DeflectionLayout
      title={t('hospice.title')}
      subtitle={t('hospice.subtitle')}
      resources={resources}
      resourcesHeading={t('trusted_resources')}
      body={
        <>
          <Text style={p}>{t('hospice.p1')}</Text>
          <Text style={p}>
            <Text style={{ fontWeight: '700' }}>{t('hospice.p2_emph')}</Text> {t('hospice.p2_tail')}
          </Text>
          <Text style={p}>{t('hospice.p3')}</Text>
        </>
      }
    />
  );
}
