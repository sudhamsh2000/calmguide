'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ApiError,
  getClinicalLink,
  linkClinicalRecord,
  previewClinicalLink,
  testClinicalLink,
  unlinkClinicalRecord,
  type ClinicalLinkStatus,
  type ClinicalLinkTestResult,
} from '@/lib/api';

/** The OpenMRS row of the Care Profile's "Connected services" card.
 *
 * Linking is two steps so the caregiver never attaches the wrong person's
 * record: paste the patient ID → CalmGuide looks it up and asks "Link to
 * <given name>?" → Link. The name comes back once from the preview call and
 * is never stored. When the server has OpenMRS switched off, the row keeps
 * its original "Coming soon" behaviour. */

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
  if (err instanceof ApiError) {
    const code = (err.body as { code?: string } | undefined)?.code;
    if (code === 'PATIENT_NOT_FOUND') return 'not_found';
    if (code === 'INVALID_PATIENT_ID' || err.status === 422) return 'invalid_id';
    if (code === 'OPENMRS_UNAVAILABLE' || err.status === 503) return 'unreachable';
  }
  return 'generic';
}

function isFeatureDisabled(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 404 &&
    (err.body as { code?: string } | undefined)?.code === 'FEATURE_DISABLED'
  );
}

export interface OpenMRSConnectionProps {
  accessCode: string;
  /** Held only in the browser, like everywhere else in the app. */
  patientName: string;
  name: string;
  hint: string;
  icon: ReactNode;
}

export function OpenMRSConnection({
  accessCode,
  patientName,
  name,
  hint,
  icon,
}: OpenMRSConnectionProps) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const inputId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [patientId, setPatientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
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
        // Feature off (or the server predates it): behave exactly as before.
        setPhase(
          isFeatureDisabled(err) || !(err instanceof ApiError)
            ? { kind: 'disabled' }
            : { kind: 'idle' },
        );
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

  const syncedLabel = (iso: string | null) => {
    if (!iso) return null;
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-Math.max(minutes, 0), 'minute');
    if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour');
    return rtf.format(-Math.round(minutes / (60 * 24)), 'day');
  };

  const primaryButton =
    'min-h-[44px] rounded-xl bg-primary px-5 text-sm font-semibold text-onPrimary transition-opacity hover:opacity-90 disabled:opacity-60 focus-ring';
  const secondaryButton =
    'min-h-[44px] rounded-xl border border-border dark:border-theme-soft bg-surface px-5 text-sm font-semibold text-accentSky transition-colors hover:bg-accentSky-soft disabled:cursor-default disabled:text-foreground-muted disabled:hover:bg-surface focus-ring';

  const connected = phase.kind === 'connected' ? phase.status : null;
  const unreachable =
    connected?.last_status === 'unavailable' || testResult?.status === 'unavailable';

  let trailing: ReactNode = null;
  if (phase.kind === 'loading') {
    trailing = (
      <span
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-label={t('services.openmrs.loading')}
      />
    );
  } else if (phase.kind === 'disabled') {
    trailing = (
      <button
        type="button"
        onClick={() => setComingSoon(true)}
        disabled={comingSoon}
        className={`shrink-0 ${secondaryButton}`}
      >
        {comingSoon ? t('services.coming_soon') : t('services.connect')}
      </button>
    );
  } else if (phase.kind === 'idle') {
    trailing = (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setPhase({ kind: 'entering' });
        }}
        className={`shrink-0 ${secondaryButton}`}
      >
        {t('services.connect')}
      </button>
    );
  } else if (connected) {
    trailing = (
      <span className="shrink-0 rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success-text">
        {t('services.openmrs.connected_badge')}
      </span>
    );
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">{name}</p>
          <p className="text-[13px] text-foreground-muted">
            {connected
              ? unreachable
                ? t('services.openmrs.unreachable_short')
                : t('services.openmrs.synced', {
                    when: syncedLabel(connected.last_synced_at) ?? t('services.openmrs.never'),
                  })
              : hint}
          </p>
        </div>
        {trailing}
      </div>

      {phase.kind === 'entering' && (
        <div className="mt-3 rounded-xl bg-primary/[0.03] p-4">
          <p className="text-sm text-foreground">
            {t('services.openmrs.explain', { name: patientName })}
          </p>
          <label htmlFor={inputId} className="mt-3 block text-sm font-semibold text-foreground">
            {t('services.openmrs.patient_id_label')}
          </label>
          <input
            id={inputId}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLookUp();
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-1.5 w-full rounded-xl border border-border dark:border-theme-soft bg-surface px-3 py-2.5 font-mono text-sm text-foreground focus-ring"
          />
          <p className="mt-1.5 text-[13px] text-foreground-muted">
            {t('services.openmrs.patient_id_hint')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleLookUp} disabled={busy} className={primaryButton}>
              {busy ? t('services.openmrs.looking_up') : t('services.connect')}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase({ kind: 'idle' });
              }}
              className={secondaryButton}
            >
              {t('services.openmrs.cancel')}
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'confirming' && (
        <div className="mt-3 rounded-xl bg-primary/[0.03] p-4">
          <p className="text-base font-semibold text-foreground">
            {phase.displayName
              ? t('services.openmrs.confirm_title', { name: phase.displayName })
              : t('services.openmrs.confirm_title_unnamed')}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">{t('services.openmrs.confirm_body')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleLink(phase.patientUuid)}
              disabled={busy}
              className={primaryButton}
            >
              {busy ? t('services.openmrs.linking') : t('services.openmrs.link')}
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'entering' })}
              className={secondaryButton}
            >
              {t('services.openmrs.cancel')}
            </button>
          </div>
        </div>
      )}

      {connected && (
        <div className="mt-3 pl-14">
          {unreachable && (
            <p className="mb-2 text-sm text-foreground">{t('services.openmrs.unreachable')}</p>
          )}
          {testResult && testResult.status !== 'unavailable' && (
            <p className="mb-2 text-sm text-foreground" role="status">
              {t('services.openmrs.test_ok', {
                conditions: testResult.conditions,
                medications: testResult.medications,
                allergies: testResult.allergies,
              })}
            </p>
          )}
          {confirmingDisconnect ? (
            <div className="rounded-xl bg-error-bg/60 p-3">
              <p className="text-sm text-foreground">{t('services.openmrs.disconnect_confirm')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={busy}
                  className="min-h-[44px] rounded-xl bg-error px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-ring"
                >
                  {t('services.openmrs.disconnect')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(false)}
                  className={secondaryButton}
                >
                  {t('services.openmrs.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={busy}
                className={secondaryButton}
              >
                {busy
                  ? t('services.openmrs.testing')
                  : unreachable
                    ? t('services.openmrs.try_again')
                    : t('services.openmrs.test')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(true)}
                className={secondaryButton}
              >
                {t('services.openmrs.disconnect')}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {t(`services.openmrs.errors.${error}`)}
        </p>
      )}
    </div>
  );
}
