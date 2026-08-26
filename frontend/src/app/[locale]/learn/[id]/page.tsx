'use client';

import { useParams } from 'next/navigation';
import { ScenarioInteraction } from '@/features/learn/ScenarioInteraction';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';

export default function ScenarioDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <MedicalDisclaimer>
      <main className="flex flex-col h-full overflow-y-auto">
        <ScenarioInteraction scenarioId={params.id} />
      </main>
    </MedicalDisclaimer>
  );
}
