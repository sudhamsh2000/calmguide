import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DeflectionLayout } from '@/components/ui/DeflectionLayout';

export const metadata: Metadata = {
  title: 'Is This Dementia? | CalmGuide',
  description: 'If you are noticing changes in a loved one, these trusted resources can help.',
};

export default async function NoticingPage() {
  const t = await getTranslations('journey.noticing');
  const tj = await getTranslations('journey');

  const resources = [
    {
      label: t('resources.ten_signs_label'),
      href: 'https://www.alz.org/alzheimers-dementia/10_signs',
      description: t('resources.ten_signs_desc'),
    },
    {
      label: t('resources.doctor_label'),
      href: 'https://www.alz.org/alzheimers-dementia/diagnosis/visiting-your-doctor',
      description: t('resources.doctor_desc'),
    },
    {
      label: t('resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('resources.nia_label'),
      href: 'https://www.nia.nih.gov/health/alzheimers-and-dementia/what-dementia-symptoms-types-and-diagnosis',
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
      <p>
        {t('p1_lead')} <strong>{t('p1_emph')}</strong>
      </p>
      <p>{t('p2')}</p>
      <p>{t('p3')}</p>
      <p className="text-sm text-foreground-muted italic">{t('footnote')}</p>
    </DeflectionLayout>
  );
}
