import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DeflectionLayout } from '@/components/ui/DeflectionLayout';

export const metadata: Metadata = {
  title: 'After Loss | CalmGuide',
  description: 'Grief after losing someone to dementia is its own journey. You are not alone.',
};

export default async function BereavementPage() {
  const t = await getTranslations('journey.bereavement');
  const tj = await getTranslations('journey');

  const resources = [
    {
      label: t('resources.lifeline_label'),
      href: 'tel:988',
      description: t('resources.lifeline_desc'),
      phone: true,
    },
    {
      label: t('resources.alz_grief_label'),
      href: 'https://www.alz.org/help-support/caregiving/caregiver-health/grief-loss-as-alzheimers-progresses',
      description: t('resources.alz_grief_desc'),
    },
    {
      label: t('resources.griefshare_label'),
      href: 'https://www.griefshare.org/',
      description: t('resources.griefshare_desc'),
    },
    {
      label: t('resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('resources.children_label'),
      href: 'https://childrengrieve.org/',
      description: t('resources.children_desc'),
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
      <p>{t('p2')}</p>
      <p>
        <strong>{t('p3_emph')}</strong> {t('p3_tail')}
      </p>
      <p>
        {t('p4_lead')} <strong>{t('p4_emph')}</strong> {t('p4_tail')}
      </p>
    </DeflectionLayout>
  );
}
