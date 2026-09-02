'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IncidentLogger } from '@/features/incidents/IncidentLogger';
import { BackButton } from '@/components/ui/BackButton';
import { ResidentContextBanner } from '@/components/facility/ResidentContextBanner';
import { FacilityModeShell } from '@/components/facility/FacilityModeShell';

export default function NewIncidentPage() {
  const t = useTranslations('incidents');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const profileId = searchParams.get('profile_id');
  const unit = searchParams.get('unit');
  const room = searchParams.get('room');
  const bed = searchParams.get('bed');
  const risk = (searchParams.get('risk') ?? 'low') as 'high' | 'moderate' | 'low';

  const isFacilityMode = !!profileId;
  const backHref = isFacilityMode
    ? `/facility/residents/${profileId}?${new URLSearchParams(
        Object.entries({ unit, room, bed }).filter(([, v]) => v != null) as [string, string][],
      ).toString()}`
    : '/home';
  const backLabel = isFacilityMode ? tc('nav.back') : tc('nav.back_to_home');

  const handleComplete = useCallback(() => {
    router.push(backHref);
  }, [router, backHref]);

  const content = (
    <main className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <BackButton href={backHref} label={backLabel} />
          <h1
            className="text-xl font-medium text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('logger.title')}
          </h1>
        </div>
      </div>
      {isFacilityMode && (
        <ResidentContextBanner unit={unit} room={room} bed={bed} riskLevel={risk} />
      )}
      <div className="flex-1 px-5 pt-4 pb-6">
        <IncidentLogger
          profileId={profileId ?? undefined}
          onComplete={isFacilityMode ? handleComplete : undefined}
        />
      </div>
    </main>
  );

  if (isFacilityMode) {
    return <FacilityModeShell>{content}</FacilityModeShell>;
  }

  return content;
}
