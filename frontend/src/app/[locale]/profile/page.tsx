import type { Metadata } from 'next';
import { ProfileView } from '@/features/profile/ProfileView';

export const metadata: Metadata = {
  title: 'Care Profile | CalmGuide',
  description: 'View and update the care profile for your loved one.',
};

export default function ProfileViewPage() {
  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <ProfileView />
    </main>
  );
}
