import type { Metadata } from 'next';
import { ProfileWizard } from '@/features/profile/ProfileWizard';

export const metadata: Metadata = {
  title: 'Setup Profile | CalmGuide',
  description: 'Create a care profile for your loved one to get personalized caregiving guidance.',
};

export default function ProfileSetupPage() {
  return (
    <main className="flex flex-col h-full overflow-y-auto px-4 py-4 pb-24 sm:px-5 sm:py-6">
      <ProfileWizard />
    </main>
  );
}
