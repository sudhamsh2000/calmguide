"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFacility } from "@/context/FacilityContext";
import { getBehavioralCard } from "@/lib/facility-api";
import type { BehavioralCard } from "@/lib/facility-api";
import { formatResidentLocation } from "@/lib/facility-utils";
import { BackButton } from "@/components/ui/BackButton";

export default function BehavioralCardPage() {
  const t = useTranslations("facility.residents");
  const ti = useTranslations("incidents");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state } = useFacility();
  const profileId = params.id as string;
  const locale = (params.locale as string) ?? "en";
  const unit = searchParams.get("unit");
  const room = searchParams.get("room");
  const bed = searchParams.get("bed");
  const risk = searchParams.get("risk") ?? "low";

  const [card, setCard] = useState<BehavioralCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadedRef = useRef(false);

  const loadCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBehavioralCard(profileId);
      setCard(data);
    } catch {
      setError("Behavioral profile unavailable. Try again or check another resident.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (state.authenticated && !loadedRef.current) {
      loadedRef.current = true;
      loadCard();
    }
  }, [state.authenticated, loadCard]);

  const translateCategory = (raw: string) => {
    const key = `logger.category.${raw}`;
    const translated = ti.has(key) ? ti(key).replace(/\n/g, " ") : raw.replace(/_/g, " ");
    return translated;
  };

  const translateOutcome = (raw: string) => {
    const key = `history.${raw}`;
    return ti.has(key) ? ti(key) : raw.replace(/_/g, " ");
  };

  const location = formatResidentLocation(unit, room, bed);

  return (
    <div className="flex flex-col h-full">
    <main className="flex-1 overflow-y-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-4">
        <BackButton href="/facility/residents" label={t("back")} />
        <h1 className="text-xl font-medium text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          {location !== "Resident" ? location : t("behavioral_card")}
        </h1>
      </div>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 rounded-xl bg-foreground/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {card && !loading && (
        <div className="space-y-5">
          {/* What NOT to Do */}
          <section>
            <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              {t("what_not_to_do")}
            </h2>
            {card.what_not_to_do.length > 0 ? (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3">
                <ul className="space-y-2">
                  {card.what_not_to_do.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                      <span className="text-red-400 shrink-0">•</span>
                      {(item as Record<string, string>).description ??
                        (item as Record<string, string>).intervention ??
                        String(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted italic">{t("no_contraindicated")}</p>
            )}
          </section>

          {/* What Works */}
          <section>
            <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              {t("what_works")}
            </h2>
            {card.what_works.length > 0 ? (
              <div className="rounded-xl border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 px-4 py-3">
                <ul className="space-y-2">
                  {card.what_works.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                      <span className="text-green-400 shrink-0">•</span>
                      {(item as Record<string, string>).intervention ??
                        (item as Record<string, string>).description ??
                        String(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted italic">{t("no_effective")}</p>
            )}
          </section>

          {/* Escalation Pattern */}
          {card.escalation_pattern && (
            <section>
              <h2 className="text-base font-bold text-foreground mb-3">
                {t("escalation_pattern")}
              </h2>
              <div className="rounded-xl border border-foreground/10 bg-surface px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed">
                  {card.escalation_pattern}
                </p>
              </div>
            </section>
          )}

          {/* Recent Incidents */}
          <section>
            <h2 className="text-base font-bold text-foreground mb-3">
              {t("recent_incidents")}
            </h2>
            {card.recent_incidents.length > 0 ? (
              <div className="space-y-2">
                {card.recent_incidents.map((inc, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-foreground/10 bg-surface px-4 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {translateCategory(inc.category)}
                      {inc.severity && (
                        <span className="ml-2 text-xs text-foreground-muted">
                          · {ti.has(`logger.severity.${inc.severity}`) ? ti(`logger.severity.${inc.severity}`) : inc.severity}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      {new Date(inc.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {inc.outcome && ` · ${translateOutcome(inc.outcome)}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted italic">{t("no_recent_incidents")}</p>
            )}
          </section>

        </div>
      )}
    </main>

    {card && !loading && (
      <div className="shrink-0 flex gap-3 px-5 py-3 border-t border-foreground/10 bg-background">
        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams({ profile_id: profileId, risk });
            if (unit) p.set("unit", unit);
            if (room) p.set("room", room);
            if (bed) p.set("bed", bed);
            router.push(`/${locale}/coach?${p.toString()}`);
          }}
          className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-light transition-colors"
        >
          {t("ask_coach")}
        </button>
        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams({ profile_id: profileId, risk });
            if (unit) p.set("unit", unit);
            if (room) p.set("room", room);
            if (bed) p.set("bed", bed);
            router.push(`/${locale}/incidents/new?${p.toString()}`);
          }}
          className="outline-button flex-1 h-12 rounded-xl text-base font-semibold"
        >
          {t("log_incident")}
        </button>
      </div>
    )}
    </div>
  );
}
