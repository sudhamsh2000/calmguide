'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useFacility } from '@/context/FacilityContext';
import { getFacility, updateFacility } from '@/lib/facility-api';
import { setFacilityName as storeFacilityName } from '@/lib/facility-storage';
import { resolveSupportedLocale } from '@/lib/locale';
import type { FacilityInfo } from '@/lib/facility-api';

export default function SettingsPage() {
  const { allowed } = useRequireRole('admin', 'owner');

  const t = useTranslations('facility.settings');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { state, dispatch } = useFacility();
  const facilityCode = state.facilityCode ?? '';

  const [facility, setFacility] = useState<FacilityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [timezone, setTimezone] = useState('US/Eastern');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facilityCode) return;
    setLoading(true);
    try {
      const data = await getFacility(facilityCode);
      setFacility(data);
      setName(data.name);
      setLanguage(data.default_language);
      setTimezone(data.timezone);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [facilityCode]);

  useEffect(() => {
    if (state.authenticated) load();
  }, [state.authenticated, load]);

  const canSave =
    !!facility &&
    (name.trim() !== facility.name ||
      language !== facility.default_language ||
      timezone !== facility.timezone);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!facilityCode || !name.trim() || !canSave) return;

      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      try {
        const updated = await updateFacility(facilityCode, {
          name: name.trim(),
          default_language: language,
          timezone,
        });
        storeFacilityName(updated.name);
        dispatch({
          type: 'SET_FACILITY',
          payload: {
            facilityCode,
            facilityName: updated.name,
          },
        });
        setFacility(updated);
        setName(updated.name);
        setLanguage(updated.default_language);
        setTimezone(updated.timezone);
        setSaveSuccess('Settings saved.');

        const nextLocale = resolveSupportedLocale(updated.default_language);
        if (nextLocale && nextLocale !== locale) {
          router.replace(pathname, { locale: nextLocale });
        }
      } catch {
        setSaveError('Could not save settings right now. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [canSave, dispatch, facilityCode, language, locale, name, pathname, router, timezone],
  );

  if (!allowed) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="max-w-lg">
        <h1 className="text-xl font-bold text-foreground mb-6">{t('title')}</h1>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-14 rounded-xl bg-foreground/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Facility Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('facility_name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-shell h-12 w-full px-4"
              />
            </div>

            {/* Facility Code (read-only) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('facility_code')}
              </label>
              <div className="field-readonly-shell flex h-12 items-center px-4 font-mono tracking-widest">
                {facilityCode}
              </div>
              <p className="text-xs text-foreground-muted mt-1">{t('facility_code_hint')}</p>
            </div>

            {/* Default Language */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('default_language')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="field-shell select-chevron h-12 w-full px-4"
              >
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
                <option value="hi-IN">हिन्दी</option>
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('timezone')}
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="field-shell select-chevron h-12 w-full px-4"
              >
                <option value="US/Eastern">US/Eastern</option>
                <option value="US/Central">US/Central</option>
                <option value="US/Mountain">US/Mountain</option>
                <option value="US/Pacific">US/Pacific</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </div>

            {(saveError || saveSuccess) && (
              <p
                className={`text-sm ${saveError ? 'text-error' : 'text-success'}`}
                role={saveError ? 'alert' : 'status'}
              >
                {saveError ?? saveSuccess}
              </p>
            )}

            {/* Stats */}
            {facility && (
              <div className="flex gap-6 pt-3 border-t border-foreground/10">
                <div>
                  <p className="text-lg font-bold text-foreground">{facility.patient_count}</p>
                  <p className="text-xs text-foreground-muted">{t('linked_patients')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{facility.staff_count}</p>
                  <p className="text-xs text-foreground-muted">{t('active_staff')}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!name.trim() || !canSave || saving}
              className="w-full h-12 rounded-full bg-primary text-onPrimary font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-light active:bg-primary-dark transition-colors"
            >
              {saving ? `${t('save_changes')}…` : t('save_changes')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
