'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IncidentDetail } from '@/features/incidents/IncidentDetail';
import { BackButton } from '@/components/ui/BackButton';

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('incidents');
  const tc = useTranslations('common');

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-4">
        <BackButton href="/incidents" label={t('history.title')} />
        <h1
          className="text-xl font-medium text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('history.title')}
        </h1>
      </div>
      <IncidentDetail incidentId={params.id} />
    </main>
  );
}
