import { Button } from '@/components/Button';
import { ThemedInput } from '@/components/ThemedInput';
import { useTheme } from '@/components/ThemeContext';
import {
  ClinicalLinkError,
  getClinicalLink,
  linkClinicalRecord,
  previewClinicalLink,
  testClinicalLink,
  unlinkClinicalRecord,
  type ClinicalLinkStatus,
  type ClinicalLinkTestResult,
} from '@/lib/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** The Care Profile's OpenMRS health-record row — the mobile twin of the web
 * frontend's OpenMRSConnection.
 *
 * Linking is two steps so the caregiver never attaches the wrong person's
 * record: paste the patient ID → CalmGuide looks it up and asks "Link to
 * <given name>?" → Link. The name comes back once from the preview call and is
 * never stored. The link lives on the server, so linking on web or mobile
 * applies everywhere. When the server has OpenMRS switched off, the row shows
 * "Coming soon". */

type Phase =
  | { kind: 'loading' }
  | { kind: 'disabled' }
  | { kind: 'idle' }
  | { kind: 'entering' }
  | { kind: 'confirming'; patientUuid: string; displayName: string }
  | { kind: 'connected'; status: ClinicalLinkStatus };

type ErrorKey = 'invalid_id' | 'not_found' | 'unreachable' | 'generic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorKeyFor(err: unknown): ErrorKey {
  if (err instanceof ClinicalLinkError) {
    if (err.code === 'PATIENT_NOT_FOUND') return 'not_found';
    if (err.code === 'INVALID_PATIENT_ID' || err.status === 422) return 'invalid_id';
    if (err.code === 'OPENMRS_UNAVAILABLE' || err.status === 503) return 'unreachable';
  }
  return 'generic';
}

export interface HealthRecordLinkProps {
  accessCode: string;
  /** Held only on the device, like everywhere else in the app. */
  patientName: string;
}

export function HealthRecordLink({ accessCode, patientName }: HealthRecordLinkProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('profile');
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [patientId, setPatientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [testResult, setTestResult] = useState<ClinicalLinkTestResult | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClinicalLink(accessCode)
      .then((status) => {
        if (!cancelled) setPhase(status.linked ? { kind: 'connected', status } : { kind: 'idle' });
      })
      .catch((err) => {
        if (cancelled) return;
        // Feature off, an older server, or offline: show the row as not yet available.
        const featureOff =
          !(err instanceof ClinicalLinkError) ||
          (err.status === 404 && err.code === 'FEATURE_DISABLED');
        setPhase(featureOff ? { kind: 'disabled' } : { kind: 'idle' });
      });
    return () => {
      cancelled = true;
    };
  }, [accessCode]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorKeyFor(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLookUp = () => {
    const uuid = patientId.trim().toLowerCase();
    if (!UUID_RE.test(uuid)) {
      setError('invalid_id');
      return;
    }
    void run(async () => {
      const preview = await previewClinicalLink(accessCode, uuid);
      setPhase({ kind: 'confirming', patientUuid: uuid, displayName: preview.display_name });
    });
  };

  const handleLink = (patientUuid: string) =>
    run(async () => {
      const status = await linkClinicalRecord(accessCode, patientUuid);
      setPatientId('');
      setTestResult(null);
      setPhase({ kind: 'connected', status });
    });

  const handleTest = () =>
    run(async () => {
      const result = await testClinicalLink(accessCode);
      setTestResult(result);
      const status = await getClinicalLink(accessCode);
      setPhase({ kind: 'connected', status });
    });

  const handleDisconnect = () =>
    run(async () => {
      await unlinkClinicalRecord(accessCode);
      setConfirmingDisconnect(false);
      setTestResult(null);
      setPhase({ kind: 'idle' });
    });

  const syncedLabel = (iso: string | null): string => {
    if (!iso) return t('services.openmrs.never', 'not yet');
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return t('services.openmrs.just_now', 'just now');
    if (minutes < 60)
      return t('services.openmrs.minutes_ago', '{count} min ago', { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t('services.openmrs.hours_ago', '{count} h ago', { count: hours });
    return t('services.openmrs.days_ago', '{count} d ago', { count: Math.round(hours / 24) });
  };

  const connected = phase.kind === 'connected' ? phase.status : null;
  const unreachable =
    connected?.last_status === 'unavailable' || testResult?.status === 'unavailable';

  const subtitle = connected
    ? unreachable
      ? t('services.openmrs.unreachable_short', "Can't reach record")
      : t('services.openmrs.synced', 'Connected · synced {when}', {
          when: syncedLabel(connected.last_synced_at),
        })
    : t('services.openmrs_hint', 'Sync clinical information');

  return (
    <View
      testID="health-record-link"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: 10,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '500' }}>OpenMRS</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 3 }}>
            {subtitle}
          </Text>
        </View>
        {phase.kind === 'loading' ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            accessibilityLabel={t('services.openmrs.loading', 'Checking connection…')}
          />
        ) : null}
        {phase.kind === 'disabled' ? (
          <Text style={{ fontSize: 13, color: colors.mutedForeground, fontWeight: '600' }}>
            {t('services.coming_soon', 'Coming soon')}
          </Text>
        ) : null}
        {phase.kind === 'idle' ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              setError(null);
              setPhase({ kind: 'entering' });
            }}
          >
            {t('services.connect', 'Connect')}
          </Button>
        ) : null}
        {connected ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.success + '22',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>
              {t('services.openmrs.connected_badge', 'Connected')}
            </Text>
          </View>
        ) : null}
      </View>

      {phase.kind === 'entering' ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
            {t(
              'services.openmrs.explain',
              "Link {name}'s record so Moment Coach can take their conditions, medications and recent readings into account. It's only used on everyday questions, never in an emergency.",
              { name: patientName },
            )}
          </Text>
          <ThemedInput
            label={t('services.openmrs.patient_id_label', 'OpenMRS patient ID')}
            value={patientId}
            onChangeText={setPatientId}
            onSubmitEditing={handleLookUp}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            accessibilityLabel={t('services.openmrs.patient_id_label', 'OpenMRS patient ID')}
          />
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
            {t(
              'services.openmrs.patient_id_hint',
              "The long ID from the patient's OpenMRS record. Ask their care team if you don't have it.",
            )}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button variant="primary" size="md" onPress={handleLookUp} loading={busy}>
              {t('services.connect', 'Connect')}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onPress={() => {
                setError(null);
                setPhase({ kind: 'idle' });
              }}
            >
              {t('services.openmrs.cancel', 'Cancel')}
            </Button>
          </View>
        </View>
      ) : null}

      {phase.kind === 'confirming' ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '600' }}>
            {phase.displayName
              ? t('services.openmrs.confirm_title', 'Link to {name}?', {
                  name: phase.displayName,
                })
              : t('services.openmrs.confirm_title_unnamed', 'Link this record?')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            {t('services.openmrs.confirm_body', 'Check this is the right person before linking.')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              variant="primary"
              size="md"
              onPress={() => void handleLink(phase.patientUuid)}
              loading={busy}
            >
              {t('services.openmrs.link', 'Link')}
            </Button>
            <Button variant="ghost" size="md" onPress={() => setPhase({ kind: 'entering' })}>
              {t('services.openmrs.cancel', 'Cancel')}
            </Button>
          </View>
        </View>
      ) : null}

      {connected ? (
        <View style={{ gap: 10 }}>
          {unreachable ? (
            <Text style={{ fontSize: 14, color: colors.foreground }}>
              {t(
                'services.openmrs.unreachable',
                "CalmGuide couldn't reach the health record. Moment Coach will keep working without it.",
              )}
            </Text>
          ) : null}
          {testResult && testResult.status !== 'unavailable' ? (
            <Text
              style={{ fontSize: 14, color: colors.foreground }}
              accessibilityLiveRegion="polite"
            >
              {t(
                'services.openmrs.test_ok',
                'Record found: {conditions} conditions, {medications} medications, {allergies} allergies.',
                {
                  conditions: testResult.conditions,
                  medications: testResult.medications,
                  allergies: testResult.allergies,
                },
              )}
            </Text>
          ) : null}
          {confirmingDisconnect ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 14, color: colors.foreground }}>
                {t(
                  'services.openmrs.disconnect_confirm',
                  'Disconnect the health record? Moment Coach will stop using it. You can link it again at any time.',
                )}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  variant="danger"
                  size="md"
                  onPress={() => void handleDisconnect()}
                  loading={busy}
                >
                  {t('services.openmrs.disconnect', 'Disconnect')}
                </Button>
                <Button variant="ghost" size="md" onPress={() => setConfirmingDisconnect(false)}>
                  {t('services.openmrs.cancel', 'Cancel')}
                </Button>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => void handleTest()}
                loading={busy}
              >
                {unreachable
                  ? t('services.openmrs.try_again', 'Try again')
                  : t('services.openmrs.test', 'Test connection')}
              </Button>
              <Button variant="ghost" size="sm" onPress={() => setConfirmingDisconnect(true)}>
                {t('services.openmrs.disconnect', 'Disconnect')}
              </Button>
            </View>
          )}
        </View>
      ) : null}

      {error ? (
        <Text style={{ fontSize: 14, color: colors.error }} accessibilityRole="alert">
          {t(`services.openmrs.errors.${error}`)}
        </Text>
      ) : null}
    </View>
  );
}
