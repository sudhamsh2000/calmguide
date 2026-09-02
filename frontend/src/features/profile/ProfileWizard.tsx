'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { createProfile, updateProfile, validateInviteCode } from '@/lib/api';
import { setPatientName, setAccessCode, getPatientName, getAccessCode } from '@/lib/storage';
import { useProfile } from '@/context/ProfileContext';
import { StepInviteCode } from './StepInviteCode';
import { StepPatientName } from './StepPatientName';
import { StepDiseaseStage } from './StepDiseaseStage';
import { StepChipSelector } from './StepChipSelector';
import {
  type DiseaseStage,
  type WizardFormData,
  BEHAVIORAL_PATTERNS,
  CALMING_STRATEGIES,
  SAFETY_CONCERNS,
} from './types';

export interface ProfileWizardProps {
  className?: string;
}

export function ProfileWizard({ className = '' }: ProfileWizardProps) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get('edit') === 'true';
  const { state, dispatch } = useProfile();

  // New signups go through an extra invite-code gate step (private testing);
  // editing an existing profile skips it entirely — that user already got
  // in once. `stepOffset` shifts all the pre-existing step numbers down by
  // one when the invite step is present, without touching their logic.
  const TOTAL_STEPS = isEditing ? 5 : 6;
  const stepOffset = isEditing ? 0 : 1;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [checkingInviteCode, setCheckingInviteCode] = useState(false);
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [formData, setFormData] = useState<WizardFormData>({
    inviteCode: '',
    patientName: '',
    diseaseStage: null,
    behavioralPatterns: [],
    calmingStrategies: [],
    safetyConcerns: [],
  });
  const progressLabels = isEditing
    ? [
        t('progress.name'),
        t('progress.stage'),
        t('progress.behaviors'),
        t('progress.calming'),
        t('progress.safety'),
      ]
    : [
        t('progress.invite_code'),
        t('progress.name'),
        t('progress.stage'),
        t('progress.behaviors'),
        t('progress.calming'),
        t('progress.safety'),
      ];

  // Pre-populate form when editing an existing profile
  useEffect(() => {
    if (!isEditing) return;

    const existingName = getPatientName();
    const profile = state.profile;

    if (existingName || profile) {
      setFormData((prev) => ({
        inviteCode: prev.inviteCode,
        patientName: existingName ?? prev.patientName,
        diseaseStage: (profile?.disease_stage as DiseaseStage) ?? prev.diseaseStage,
        behavioralPatterns: profile?.behavioral_patterns ?? prev.behavioralPatterns,
        calmingStrategies: profile?.calming_strategies ?? prev.calmingStrategies,
        safetyConcerns: profile?.safety_concerns ?? prev.safetyConcerns,
      }));
    }
  }, [isEditing, state.profile]);

  const isStepValid = useCallback((): boolean => {
    if (!isEditing && step === 1) {
      return formData.inviteCode.trim().length > 0;
    }
    switch (step - stepOffset) {
      case 1:
        return formData.patientName.trim().length > 0;
      case 2:
        return formData.diseaseStage !== null;
      case 3:
        return formData.behavioralPatterns.length > 0;
      case 4:
        return formData.calmingStrategies.length > 0;
      case 5:
        return formData.safetyConcerns.length > 0;
      default:
        return false;
    }
  }, [step, formData, isEditing, stepOffset]);

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  async function handleNext() {
    if (!isStepValid()) return;

    if (!isEditing && step === 1) {
      setCheckingInviteCode(true);
      setInviteCodeError(null);
      try {
        const { valid } = await validateInviteCode(formData.inviteCode.trim());
        if (!valid) {
          setInviteCodeError(t('errors.invalid_invite_code'));
          setCheckingInviteCode(false);
          return;
        }
      } catch {
        setInviteCodeError(t('errors.generic'));
        setCheckingInviteCode(false);
        return;
      }
      setCheckingInviteCode(false);
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  }

  async function handleSubmit() {
    if (!isStepValid() || !formData.diseaseStage) return;

    setSubmitting(true);
    setError(null);

    try {
      const profileData = {
        disease_stage: formData.diseaseStage,
        behavioral_patterns: formData.behavioralPatterns,
        calming_strategies: formData.calmingStrategies,
        safety_concerns: formData.safetyConcerns,
        // Unused by updateProfile (ProfileUpdate has no invite_code field);
        // only createProfile below actually needs it.
        invite_code: formData.inviteCode.trim(),
      };

      if (isEditing) {
        const existingCode = getAccessCode();
        if (!existingCode) {
          throw new Error(t('errors.no_access_code'));
        }

        const response = await updateProfile(existingCode, profileData);

        // Update patient name in localStorage
        setPatientName(formData.patientName.trim());

        // Update profile context
        dispatch({ type: 'UPDATE_SUCCESS', payload: response });

        router.push('/profile');
      } else {
        const response = await createProfile(profileData);

        // Store patient name and access code in localStorage
        setPatientName(formData.patientName.trim());
        setAccessCode(response.access_code);

        // Update profile context
        dispatch({ type: 'FETCH_SUCCESS', payload: response });

        setSuccessCode(response.access_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setSubmitting(false);
    }
  }

  if (successCode) {
    return (
      <div className={`flex flex-col items-center gap-6 text-center ${className}`}>
        {/* Checkmark circle */}
        <div
          className="w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-lg mt-2"
          style={{ boxShadow: '0 4px 24px rgba(0,184,148,0.35)' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-10"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold text-foreground">
            {t('success.profile_created')}
          </h1>
          <p className="text-base text-foreground-muted leading-relaxed max-w-sm">
            {t('success.save_code_message')}
          </p>
        </div>

        {/* Access code display */}
        <div
          className="card-shell-selected w-full p-6 flex flex-col items-center gap-3"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}
        >
          <p className="text-xs font-bold text-foreground-muted uppercase tracking-widest">
            {t('success.access_code_label')}
          </p>
          <p
            className="text-4xl font-black text-primary tracking-[0.25em] select-all cursor-text"
            title="Click to select and copy"
          >
            {successCode}
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(successCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              } catch {
                /* clipboard unavailable; user can still long-press select */
              }
            }}
            className="outline-button inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            {codeCopied ? `✓ ${tc('actions.copied')}` : tc('actions.copy')}
          </button>
          <p className="text-sm text-foreground-muted">{t('success.screenshot_hint')}</p>
        </div>

        <Button variant="primary" size="lg" onClick={() => router.push('/home')} className="w-full">
          {t('success.start_button')}
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <ProgressBar
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        progressText={t('progress.step_of', { current: step, total: TOTAL_STEPS })}
        stepLabels={progressLabels}
      />

      {!isEditing && step === 1 && (
        <StepInviteCode
          inviteCode={formData.inviteCode}
          onChange={(code) => {
            setFormData({ ...formData, inviteCode: code });
            setInviteCodeError(null);
          }}
          error={inviteCodeError ?? undefined}
        />
      )}

      {step === 1 + stepOffset && (
        <StepPatientName
          patientName={formData.patientName}
          onChange={(name) => setFormData({ ...formData, patientName: name })}
        />
      )}

      {step === 2 + stepOffset && (
        <StepDiseaseStage
          selectedStage={formData.diseaseStage}
          onSelect={(stage: DiseaseStage) => setFormData({ ...formData, diseaseStage: stage })}
        />
      )}

      {step === 3 + stepOffset && (
        <StepChipSelector
          title={t('steps.behavioral.title')}
          description={t('steps.behavioral.description')}
          options={BEHAVIORAL_PATTERNS}
          selected={formData.behavioralPatterns}
          group="behavioral"
          onChange={(patterns) => setFormData({ ...formData, behavioralPatterns: patterns })}
        />
      )}

      {step === 4 + stepOffset && (
        <StepChipSelector
          title={t('steps.calming.title')}
          description={t('steps.calming.description')}
          options={CALMING_STRATEGIES}
          selected={formData.calmingStrategies}
          group="calming"
          onChange={(strategies) => setFormData({ ...formData, calmingStrategies: strategies })}
        />
      )}

      {step === 5 + stepOffset && (
        <StepChipSelector
          title={t('steps.safety.title')}
          description={t('steps.safety.description')}
          options={SAFETY_CONCERNS}
          selected={formData.safetyConcerns}
          group="safety"
          onChange={(concerns) => setFormData({ ...formData, safetyConcerns: concerns })}
        />
      )}

      {error && (
        <div className="rounded-xl bg-error/10 border border-error/30 p-4" role="alert">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <div className="-mx-4 sticky bottom-0 mt-1 flex gap-3 border-t border-foreground/10 bg-background/95 px-4 pb-3 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-0">
        {step > 1 && (
          <Button
            variant="secondary"
            size="lg"
            onClick={handleBack}
            disabled={submitting}
            className="flex-1"
          >
            {t('actions.back')}
          </Button>
        )}

        {step < TOTAL_STEPS ? (
          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            disabled={!isStepValid() || checkingInviteCode}
            loading={checkingInviteCode}
            className="flex-1"
          >
            {t('actions.next')}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!isStepValid() || submitting}
            loading={submitting}
            className="flex-1"
          >
            {isEditing ? t('actions.save_changes') : t('actions.create')}
          </Button>
        )}
      </div>
    </div>
  );
}
