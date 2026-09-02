import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DeflectionLayout } from '@/components/ui/DeflectionLayout';

export const metadata: Metadata = {
  title: 'After a Diagnosis | CalmGuide',
  description:
    'A new dementia diagnosis is overwhelming. These resources can help you take the first steps.',
};

export default async function DiagnosisPage() {
  const t = await getTranslations('journey.diagnosis');
  const tj = await getTranslations('journey');

  const resources = [
    {
      label: t('resources.helpline_label'),
      href: 'tel:18002723900',
      description: t('resources.helpline_desc'),
      phone: true,
    },
    {
      label: t('resources.support_label'),
      href: 'https://www.alz.org/help-support/community/support-groups',
      description: t('resources.support_desc'),
    },
    {
      label: t('resources.after_label'),
      href: 'https://www.alz.org/alzheimers-dementia/diagnosis/life-after-diagnosis',
      description: t('resources.after_desc'),
    },
    {
      label: t('resources.can_label'),
      href: 'https://www.caregiveraction.org/',
      description: t('resources.can_desc'),
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
      <p>{t('p4')}</p>
    </DeflectionLayout>
  );
}
