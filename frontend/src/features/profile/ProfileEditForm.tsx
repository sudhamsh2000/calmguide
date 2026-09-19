'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useProfile } from '@/context/ProfileContext';
import { getProfile, updateProfile } from '@/lib/api';
import {
  getAccessCode,
  getActiveProfileAvatar,
  getPatientName,
  setActiveProfileAvatar,
  type ProfileAvatar as ProfileAvatarKind,
} from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { AvatarPicker } from './AvatarPicker';
import { StepDiseaseStage } from './StepDiseaseStage';
import { StepChipSelector } from './StepChipSelector';
import {
  type DiseaseStage,
  BEHAVIORAL_PATTERNS,
  CALMING_STRATEGIES,
  SAFETY_CONCERNS,
} from './types';

export interface ProfileEditFormProps {
  className?: string;
}

export function ProfileEditForm({ className = '' }: ProfileEditFormProps) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const router = useRouter();
  const { state, dispatch } = useProfile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [diseaseStage, setDiseaseStage] = useState<DiseaseStage | null>(null);
  const [behavioralPatterns, setBehavioralPatterns] = useState<string[]>([]);
  const [calmingStrategies, setCalmingStrategies] = useState<string[]>([]);
  const [safetyConcerns, setSafetyConcerns] = useState<string[]>([]);
  const [patientName, setPatientNameState] = useState('');
  const [avatar, setAvatar] = useState<ProfileAvatarKind>('monogram');

  // Load existing profile data
  useEffect(() => {
    const code = getAccessCode();
    const name = getPatientName();

    if (!code || !name) {
      router.push('/profile/setup');
      return;
    }

    setPatientNameState(name);
    setAvatar(getActiveProfileAvatar());

    // If profile is already in context, populate from it
    if (state.profile) {
      setDiseaseStage(state.profile.disease_stage as DiseaseStage);
      setBehavioralPatterns([...state.profile.behavioral_patterns]);
      setCalmingStrategies([...state.profile.calming_strategies]);
      setSafetyConcerns([...state.profile.safety_concerns]);
      setLoading(false);
      return;
    }

    // Otherwise fetch from API
    dispatch({ type: 'FETCH_START' });
    getProfile(code)
      .then((profile) => {
        dispatch({ type: 'FETCH_SUCCESS', payload: profile });
        setDiseaseStage(profile.disease_stage as DiseaseStage);
        setBehavioralPatterns([...profile.behavioral_patterns]);
        setCalmingStrategies([...profile.calming_strategies]);
        setSafetyConcerns([...profile.safety_concerns]);
      })
      .catch((err) => {
        dispatch({ type: 'FETCH_ERROR', payload: err.message });
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const code = getAccessCode();
    if (!code || !diseaseStage) return;

    setSaving(true);
    setError(null);

    try {
      const response = await updateProfile(code, {
        disease_stage: diseaseStage,
        behavioral_patterns: behavioralPatterns,
        calming_strategies: calmingStrategies,
        safety_concerns: safetyConcerns,
      });

      // The portrait never leaves the device — the profile endpoint has
      // nowhere to put it, by design — so it is saved locally alongside
      // the name, in the same action as the clinical fields.
      setActiveProfileAvatar(avatar);

      dispatch({ type: 'UPDATE_SUCCESS', payload: response });
      router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isValid =
    diseaseStage !== null &&
    behavioralPatterns.length > 0 &&
    calmingStrategies.length > 0 &&
    safetyConcerns.length > 0;

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 py-3">
        <BackButton href="/profile" label={tc('nav.back_to_home')} />
        <h1
          className="text-xl font-medium text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('edit_title')}
        </h1>
      </div>

      {/* Portrait — the one choice here that is about the person rather
       * than the condition, so it leads. */}
      <div className="mt-6">
        <AvatarPicker
          name={patientName}
          value={avatar}
          diseaseStage={diseaseStage ?? undefined}
          onChange={setAvatar}
        />
      </div>

      {/* Disease Stage */}
      <div className="mt-10">
        <StepDiseaseStage selectedStage={diseaseStage} onSelect={setDiseaseStage} />
      </div>

      {/* Behavioral Patterns */}
      <div className="mt-10">
        <StepChipSelector
          title={t('steps.behavioral.title')}
          description={t('steps.behavioral.description')}
          options={BEHAVIORAL_PATTERNS}
          selected={behavioralPatterns}
          group="behavioral"
          onChange={setBehavioralPatterns}
        />
      </div>

      {/* Calming Strategies */}
      <div className="mt-10">
        <StepChipSelector
          title={t('steps.calming.title')}
          description={t('steps.calming.description')}
          options={CALMING_STRATEGIES}
          selected={calmingStrategies}
          group="calming"
          onChange={setCalmingStrategies}
        />
      </div>

      {/* Safety Concerns */}
      <div className="mt-10">
        <StepChipSelector
          title={t('steps.safety.title')}
          description={t('steps.safety.description')}
          options={SAFETY_CONCERNS}
          selected={safetyConcerns}
          group="safety"
          onChange={setSafetyConcerns}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl bg-error/10 border border-error/30 p-4" role="alert">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex gap-3 pb-6">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.push('/profile')}
          disabled={saving}
          className="flex-1"
        >
          {t('sign_out.cancel')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          disabled={!isValid || saving}
          loading={saving}
          className="flex-1"
        >
          {t('actions.save_changes')}
        </Button>
      </div>
    </div>
  );
}
