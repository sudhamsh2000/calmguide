import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DeflectionLayout } from '@/components/ui/DeflectionLayout';

export const metadata: Metadata = {
  title: 'Hospice & End of Life | CalmGuide',
  description:
    'When dementia reaches its final stage, these trusted resources can guide you through.',
};

export default async function HospicePage() {
  const t = await getTranslations('journey.hospice');
  const tj = await getTranslations('journey');

  const resources = [
    {
      label: t('resources.hfa_label'),
      href: 'https://hospicefoundation.org/',
      description: t('resources.hfa_desc'),
    },
    {
      label: t('resources.alz_late_label'),
      href: 'https://www.alz.org/help-support/caregiving/stages-behaviors/late-stage',
      description: t('resources.alz_late_desc'),
    },
    {
      label: t('resources.nhpco_label'),
      href: 'https://www.nhpco.org/',
      description: t('resources.nhpco_desc'),
    },
    {
      label: t('resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('resources.nia_label'),
      href: 'https://www.nia.nih.gov/health/end-life',
      description: t('resources.nia_desc'),
    },
  ];

  return (
    <DeflectionLayout
      title={t('title')}
      subtitle={t('subtitle')}
      resources={resources}
      resourcesHeading={tj('trusted_resources')}
    >
      <p>{t('p1')}</p>
      <p>
        <strong>{t('p2_emph')}</strong> {t('p2_tail')}
      </p>
      <p>{t('p3')}</p>
    </DeflectionLayout>
  );
}
