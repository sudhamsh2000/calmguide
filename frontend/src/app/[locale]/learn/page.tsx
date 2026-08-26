import type { Metadata } from 'next';
import { ScenarioList } from '@/features/learn/ScenarioList';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';

export const metadata: Metadata = {
  title: 'Learn | CalmGuide',
  description: 'Practice handling common dementia caregiving scenarios with AI-guided exercises.',
};

export default function LearnPage() {
  return (
    <MedicalDisclaimer>
      <main className="flex flex-col h-full overflow-y-auto">
        <ScenarioList />
      </main>
    </MedicalDisclaimer>
  );
}
