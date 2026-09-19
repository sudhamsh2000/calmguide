import type { ProfileAvatar } from '@/lib/storage';

export type DiseaseStage = 'early' | 'middle' | 'late';

export interface WizardFormData {
  inviteCode: string;
  patientName: string;
  /** Chosen alongside the name; never sent to the server. */
  avatar: ProfileAvatar;
  diseaseStage: DiseaseStage | null;
  behavioralPatterns: string[];
  calmingStrategies: string[];
  safetyConcerns: string[];
}

export const BEHAVIORAL_PATTERNS = [
  'Sundowning',
  'Wandering/exit-seeking',
  'Aggression',
  'Repetitive questions',
  'Sleep disturbance',
  'Refusal to eat',
  'Hallucinations',
  'Hiding/hoarding objects',
  'Undressing inappropriately',
  'Shadowing/following caregiver',
] as const;

export const CALMING_STRATEGIES = [
  'Music (specify favorite)',
  'Family photos',
  'Warm drink',
  'Going for a walk',
  'Gentle hand massage',
  'Favorite TV show',
  'Pet interaction',
  'Rocking chair',
  'Aromatherapy',
] as const;

export const SAFETY_CONCERNS = [
  'Fall risk',
  'Wandering/elopement risk',
  'Stove/fire risk',
  'Medication confusion',
  'Aggressive when frustrated',
  'Cannot be left alone',
  'Driving risk',
  'Pool/water nearby',
] as const;

export const DISEASE_STAGE_INFO: Record<DiseaseStage, { title: string; description: string }> = {
  early: {
    title: 'Early Stage',
    description:
      'Mild memory lapses, difficulty finding words, some confusion with complex tasks. Can still manage most daily activities independently.',
  },
  middle: {
    title: 'Middle Stage',
    description:
      'Increasing confusion, difficulty recognizing people, behavioral changes, needs help with daily activities like dressing and bathing.',
  },
  late: {
    title: 'Late Stage',
    description:
      'Severe memory loss, limited communication, needs full-time assistance with all daily activities, may not recognize family members.',
  },
};
