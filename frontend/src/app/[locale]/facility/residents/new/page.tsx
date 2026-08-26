"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFacility } from "@/context/FacilityContext";
import {
  createResident,
  createAssignment,
  getStaffList,
  FacilityApiError,
} from "@/lib/facility-api";
import type { StaffInfo } from "@/lib/facility-api";

type DiseaseStage = "early" | "middle" | "late" | "unknown";

function TagInput({
  items,
  onChange,
  placeholder,
  hint,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  hint: string;
}) {
  const [input, setInput] = useState("");

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            const val = e.target.value;
            if (val.endsWith(",")) {
              const trimmed = val.slice(0, -1).trim();
              if (trimmed && !items.includes(trimmed)) {
                onChange([...items, trimmed]);
              }
              setInput("");
            } else {
              setInput(val);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          className="field-shell flex-1 h-12 px-4 text-sm"
        />
      </div>
      <p className="text-xs text-foreground-muted mt-1">{hint}</p>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm text-foreground"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-foreground-muted hover:text-error"
                aria-label={`Remove ${item}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddResidentPage() {
  const { allowed } = useRequireRole("admin", "owner");
  if (!allowed) return null;

  return <AddResidentForm />;
}

function AddResidentForm() {
  const t = useTranslations("facility.add_resident");
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const { state } = useFacility();
  const facilityCode = state.facilityCode ?? "";

  const [stage, setStage] = useState<DiseaseStage>("middle");
  const [unit, setUnit] = useState("");
  const [room, setRoom] = useState("");
  const [bed, setBed] = useState("");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<StaffInfo[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    accessCode: string;
    assignedCount: number;
  } | null>(null);

  useEffect(() => {
    if (!facilityCode) return;
    getStaffList(facilityCode)
      .then((res) => {
        const careStaff = res.staff.filter((s) => s.is_active && s.role === "staff");
        setStaffList(careStaff);
      })
      .catch(() => {})
      .finally(() => setStaffLoading(false));
  }, [facilityCode]);

  const toggleStaff = (id: string) => {
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const result = await createResident(facilityCode, {
          disease_stage: stage,
          behavioral_patterns: patterns.length > 0 ? patterns : undefined,
          calming_strategies: strategies.length > 0 ? strategies : undefined,
          safety_concerns: concerns.length > 0 ? concerns : undefined,
          unit: unit.trim() || undefined,
          room: room.trim() || undefined,
          bed: bed.trim() || undefined,
        });

        let assignedCount = 0;
        for (const staffId of selectedStaff) {
          try {
            await createAssignment(facilityCode, {
              staff_id: staffId,
              profile_id: result.profile_id,
            });
            assignedCount++;
          } catch {
            // Assignment failed for this staff — continue with others
          }
        }

        setSuccess({ accessCode: result.access_code, assignedCount });
      } catch (err) {
        if (err instanceof FacilityApiError) {
          setError(t("error"));
        } else {
          setError(t("error"));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [stage, unit, room, bed, patterns, strategies, concerns, selectedStaff, facilityCode, t],
  );

  const resetForm = () => {
    setStage("middle");
    setUnit("");
    setRoom("");
    setBed("");
    setPatterns([]);
    setStrategies([]);
    setConcerns([]);
    setSelectedStaff([]);
    setSuccess(null);
    setError(null);
  };

  if (success) {
    return (
      <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
        <div className="max-w-lg flex-1 flex flex-col items-center justify-center text-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F0E7]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3A7D5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            {t("success_title")}
          </h2>
          <div className="card-shell-selected rounded-xl px-6 py-4">
            <p className="text-sm text-foreground-muted mb-1">Access Code</p>
            <p className="text-2xl font-mono font-bold tracking-[0.2em] text-primary">{success.accessCode}</p>
          </div>
          <p className="text-sm text-foreground-muted max-w-xs">
            {t("success_message", { code: success.accessCode })}
          </p>
          {success.assignedCount > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              {t("assigned_count", { count: success.assignedCount })}
            </p>
          )}
          <div className="flex gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-light transition-colors"
            >
              {t("add_another")}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/facility/residents-all`)}
              className="flex-1 h-12 rounded-xl border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors dark:border-primary/25"
            >
              {t("view_residents")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const stageOptions: { value: DiseaseStage; label: string }[] = [
    { value: "early", label: t("stage_early") },
    { value: "middle", label: t("stage_middle") },
    { value: "late", label: t("stage_late") },
    { value: "unknown", label: t("stage_unknown") },
  ];

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="max-w-lg">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-primary hover:underline mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          {t("back")}
        </button>

        <h1 className="text-xl font-bold text-foreground mb-6" style={{ fontFamily: "var(--font-display)" }}>
          {t("title")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Disease Stage */}
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-2">{t("disease_stage")} *</legend>
            <div className="grid grid-cols-2 gap-2">
              {stageOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-center h-11 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                    stage === opt.value
                      ? "border-border bg-primary/[0.06] text-primary dark:border-[#31445f] dark:bg-primary/[0.08] dark:text-primary-light"
                      : "border-border dark:border-[#31445f] bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]"
                  }`}
                >
                  <input
                    type="radio"
                    name="stage"
                    value={opt.value}
                    checked={stage === opt.value}
                    onChange={() => setStage(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Location */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">{t("location")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("unit")}</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder={t("unit_placeholder")}
                  className="field-shell w-full h-11 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("room")}</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder={t("room_placeholder")}
                  className="field-shell w-full h-11 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("bed")}</label>
                <input
                  type="text"
                  value={bed}
                  onChange={(e) => setBed(e.target.value)}
                  placeholder={t("bed_placeholder")}
                  className="field-shell w-full h-11 px-3 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Assign to Staff */}
          {!staffLoading && staffList.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1">{t("assign_staff")}</p>
              <p className="text-xs text-foreground-muted mb-3">{t("assign_hint")}</p>
              <div className="space-y-2">
                {staffList.map((staff) => {
                  const checked = selectedStaff.includes(staff.id);
                  return (
                    <label
                      key={staff.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        checked
                          ? "border-border bg-primary/[0.06] dark:border-[#31445f] dark:bg-primary/[0.08]"
                          : "border-border dark:border-[#31445f] bg-surface hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStaff(staff.id)}
                        className="size-5 accent-primary rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{staff.name}</p>
                        <p className="text-xs text-foreground-muted">
                          {staff.assigned_patients_count} {t("assign_current")}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Behavioral Profile — Optional */}
          <div className="border-t border-foreground/10 pt-5">
            <p className="text-xs text-foreground-muted mb-4">{t("optional_section")}</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("behavioral_patterns")}</label>
                <TagInput
                  items={patterns}
                  onChange={setPatterns}
                  placeholder={t("behavioral_placeholder")}
                  hint={t("hint_comma")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("calming_strategies")}</label>
                <TagInput
                  items={strategies}
                  onChange={setStrategies}
                  placeholder={t("calming_placeholder")}
                  hint={t("hint_comma")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("safety_concerns")}</label>
                <TagInput
                  items={concerns}
                  onChange={setConcerns}
                  placeholder={t("safety_placeholder")}
                  hint={t("hint_comma")}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-base disabled:opacity-40 hover:bg-primary-light active:bg-primary-dark transition-colors"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
