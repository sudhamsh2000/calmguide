'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationProvider } from '@elevenlabs/react';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { FacilityModeShell } from '@/components/facility/FacilityModeShell';
import { formatResidentLocation } from '@/lib/facility-utils';
import { useVoiceCall } from '@/features/voice/useVoiceCall';
import { VoiceCallView } from '@/features/voice/VoiceCallView';

function VoiceCallInner() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profile_id') ?? undefined;
  const unit = searchParams.get('unit');
  const room = searchParams.get('room');
  const bed = searchParams.get('bed');
  const residentName = profileId ? formatResidentLocation(unit, room, bed) : undefined;

  const call = useVoiceCall({ profileId, patientNameOverride: residentName });

  // Facility mode keeps the resident context on the way back and over to text.
  const facilityQuery = profileId
    ? new URLSearchParams(
        Object.entries({ profile_id: profileId, unit, room, bed }).filter(([, v]) => v != null) as [
          string,
          string,
        ][],
      ).toString()
    : '';
  const backHref = profileId ? `/coach?${facilityQuery}` : '/coach';

  return (
    <VoiceCallView
      phase={call.phase}
      error={call.error}
      transcript={call.transcript}
      emergency={call.emergency}
      isSpeaking={call.isSpeaking}
      isMuted={call.isMuted}
      backHref={backHref}
      textCoachHref={backHref}
      onStart={() => void call.start()}
      onEnd={call.end}
      onToggleMute={() => call.setMuted(!call.isMuted)}
      onDismissEmergency={call.clearEmergency}
    />
  );
}

function VoiceCallContent() {
  return (
    <MedicalDisclaimer>
      <ConversationProvider>
        <Suspense>
          <VoiceCallInner />
        </Suspense>
      </ConversationProvider>
    </MedicalDisclaimer>
  );
}

function FacilityDetector() {
  const searchParams = useSearchParams();
  if (searchParams.get('profile_id')) {
    return (
      <FacilityModeShell>
        <VoiceCallContent />
      </FacilityModeShell>
    );
  }
  return <VoiceCallContent />;
}

export default function VoiceCallPage() {
  return (
    <Suspense>
      <FacilityDetector />
    </Suspense>
  );
}
