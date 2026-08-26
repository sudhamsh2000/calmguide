import { DeflectionLayout } from '@/components/DeflectionLayout';
import { useTheme } from '@/components/ThemeContext';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function BereavementScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('journey');
  const p = { fontSize: 15, color: colors.foreground, lineHeight: 23 };

  const resources = [
    {
      label: t('bereavement.resources.lifeline_label'),
      href: 'tel:988',
      description: t('bereavement.resources.lifeline_desc'),
      phone: true,
    },
    {
      label: t('bereavement.resources.alz_grief_label'),
      href: 'https://www.alz.org/help-support/caregiving/caregiver-health/grief-loss-as-alzheimers-progresses',
      description: t('bereavement.resources.alz_grief_desc'),
    },
    {
      label: t('bereavement.resources.griefshare_label'),
      href: 'https://www.griefshare.org/',
      description: t('bereavement.resources.griefshare_desc'),
    },
    {
      label: t('bereavement.resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('bereavement.resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('bereavement.resources.children_label'),
      href: 'https://childrengrieve.org/',
      description: t('bereavement.resources.children_desc'),
    },
  ];

  return (
    <DeflectionLayout
      title={t('bereavement.title')}
      subtitle={t('bereavement.subtitle')}
      resources={resources}
      resourcesHeading={t('trusted_resources')}
      body={
        <>
          <Text style={p}>{t('bereavement.p1')}</Text>
          <Text style={p}>{t('bereavement.p2')}</Text>
          <Text style={p}>
            <Text style={{ fontWeight: '700' }}>{t('bereavement.p3_emph')}</Text>{' '}
            {t('bereavement.p3_tail')}
          </Text>
          <Text style={p}>
            {t('bereavement.p4_lead')}{' '}
            <Text style={{ fontWeight: '700' }}>{t('bereavement.p4_emph')}</Text>{' '}
            {t('bereavement.p4_tail')}
          </Text>
        </>
      }
    />
  );
}
