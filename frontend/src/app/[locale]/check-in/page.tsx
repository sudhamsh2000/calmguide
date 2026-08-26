import type { Metadata } from 'next';
import { CheckInScreen } from '@/features/checkin/CheckInScreen';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';

export const metadata: Metadata = {
  title: 'Check In | CalmGuide',
  description: 'Take a moment to check in with yourself.',
};

export default function CheckInPage() {
  return (
    <MedicalDisclaimer>
      <main className="flex flex-col h-full overflow-y-auto">
        <CheckInScreen />
      </main>
    </MedicalDisclaimer>
  );
}
