import type { Metadata } from 'next';
import { ProfileEditForm } from '@/features/profile/ProfileEditForm';

export const metadata: Metadata = {
  title: 'Edit Profile | CalmGuide',
  description: 'Update the care profile for your loved one.',
};

export default function ProfileEditPage() {
  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <ProfileEditForm />
    </main>
  );
}
