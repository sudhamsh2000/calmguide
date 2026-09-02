import type { Metadata } from 'next';
import { HomeScreen } from '@/features/home/HomeScreen';

export const metadata: Metadata = {
  title: 'Home | CalmGuide',
  description:
    'Your CalmGuide home screen with quick access to moment coaching and learning scenarios.',
};

export default function HomePage() {
  return (
    <main className="flex flex-col h-full overflow-y-auto">
      <HomeScreen />
    </main>
  );
}
