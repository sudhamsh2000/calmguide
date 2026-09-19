'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFacility } from '@/context/FacilityContext';
import {
  getAssignments,
  getStaffList,
  getMyResidents,
  createAssignment,
  deleteAssignment,
} from '@/lib/facility-api';
import type { ResidentSummary, AssignmentResponse, StaffInfo } from '@/lib/facility-api';

const RISK_DOT: Record<string, string> = {
  high: 'bg-red-500',
  moderate: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function AssignPatientsPage() {
  const { allowed } = useRequireRole('admin', 'owner');

  const t = useTranslations('facility.staff');
  const tRisk = useTranslations('facility.residents');
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;
  const { state } = useFacility();
  const facilityCode = state.facilityCode ?? '';

  const [residents, setResidents] = useState<ResidentSummary[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!facilityCode) return;
    setLoading(true);
    try {
      const [resData, assignData, staffData] = await Promise.all([
        getMyResidents(),
        getAssignments(facilityCode, staffId),
        getStaffList(facilityCode),
      ]);
      const matchedStaff = staffData.staff.find((staff: StaffInfo) => staff.id === staffId);
      setResidents(resData.residents);
      setAssignments(assignData.assignments);
      setSelected(new Set(assignData.assignments.map((a) => a.profile_id)));
      setStaffName(matchedStaff?.name ?? '');
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [facilityCode, staffId]);

  useEffect(() => {
    if (state.authenticated) load();
  }, [state.authenticated, load]);

  const toggleResident = useCallback((profileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const currentIds = new Set(assignments.map((a) => a.profile_id));
      const toAdd = [...selected].filter((id) => !currentIds.has(id));
      const toRemove = assignments.filter((a) => !selected.has(a.profile_id));

      await Promise.all([
        ...toAdd.map((profileId) =>
          createAssignment(facilityCode, { staff_id: staffId, profile_id: profileId }),
        ),
        ...toRemove.map((a) => deleteAssignment(facilityCode, a.id)),
      ]);
      router.back();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [selected, assignments, facilityCode, staffId, router]);

  if (!allowed) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="max-w-lg">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-accentSky hover:underline mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          {t('title')}
        </button>

        <h1 className="text-xl font-bold text-foreground mb-6">
          {t('assign_title', { name: staffName || staffId.slice(0, 8) })}
        </h1>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-12 rounded-lg bg-foreground/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              {residents.map((r) => (
                <label
                  key={r.profile_id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-foreground/10 cursor-pointer hover:bg-foreground/[.02] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.profile_id)}
                    onChange={() => toggleResident(r.profile_id)}
                    className="size-5 accent-primary"
                  />
                  <span className="flex-1 text-sm font-medium text-foreground">
                    {r.room ? `Room ${r.room}` : r.profile_id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-foreground-muted capitalize">
                    {r.disease_stage}
                  </span>
                  <span
                    className={`size-2 rounded-full ${RISK_DOT[r.risk_level] ?? 'bg-gray-400'}`}
                  />
                </label>
              ))}
            </div>

            <p className="text-sm text-foreground-muted mb-4">
              {t('assigned_count', { count: selected.size, total: residents.length })}
            </p>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-full bg-primary text-onPrimary font-semibold text-base disabled:opacity-40 hover:bg-primary-light active:bg-primary-dark transition-colors"
            >
              {saving ? 'Saving...' : t('save_assignments')}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
