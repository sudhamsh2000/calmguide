"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useTranslations } from "next-intl";
import { useFacility } from "@/context/FacilityContext";
import { downloadReport, getTrends } from "@/lib/facility-api";
import type { TrendsData } from "@/lib/facility-api";

type Period = "7d" | "30d" | "90d";

export default function TrendsPage() {
  const { allowed } = useRequireRole("admin", "owner");
  if (!allowed) return null;

  const t = useTranslations("facility.trends");
  const { state } = useFacility();

  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const trends = await getTrends(p);
      setData(trends);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.authenticated) load(period);
  }, [state.authenticated, period, load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      await downloadReport(days);
    } catch {
      setExportError("Could not export the report right now. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }, [period]);

  const periods: Period[] = ["7d", "30d", "90d"];

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
        
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
            <div className="card-shell overflow-hidden rounded-lg p-1">
              {periods.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 h-9 text-sm font-medium transition-colors ${
                    period === p
                      ? "rounded-md bg-primary text-white"
                      : "rounded-md text-foreground hover:bg-primary/[0.05] dark:hover:bg-primary/[0.08]"
                  }`}
                >
                  {t(`period_${p}` as "period_7d" | "period_30d" | "period_90d")}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-40 rounded-xl bg-foreground/5 animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <div className="space-y-8">
              {/* Time of Day Distribution */}
              <section>
                <h2 className="text-base font-bold text-foreground mb-3">
                  {t("time_distribution")}
                </h2>
                <div className="card-shell rounded-xl p-4 space-y-3">
                  {(["overnight", "morning", "afternoon", "evening"] as const).map((slot) => {
                    const total = Object.values(data.time_distribution).reduce((a, b) => a + b, 0) || 1;
                    const count = data.time_distribution[slot] ?? 0;
                    const pct = Math.round((count / total) * 100);
                    const isMax = count === Math.max(...Object.values(data.time_distribution));
                    return (
                      <div key={slot} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-24">
                          {t(slot as "overnight" | "morning" | "afternoon" | "evening")}
                        </span>
                        <div className="flex-1 h-5 bg-foreground/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-foreground-muted w-12 text-right">
                          {pct}%
                        </span>
                        {isMax && (
                          <span className="text-xs text-primary font-medium">
                            ← {t("peak")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Intervention Effectiveness */}
              <section>
                <h2 className="text-base font-bold text-foreground mb-3">
                  {t("intervention_effectiveness")}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-foreground/[.06] bg-background/80 dark:border-white/[.12] dark:bg-white/[.02]">
                  <table className="w-full text-start text-sm">
                    <thead className="bg-foreground/[.02] dark:bg-white/[.015]">
                      <tr>
                        <th className="px-4 py-3 font-medium text-foreground-muted">{t("intervention")}</th>
                        <th className="px-4 py-3 font-medium text-foreground-muted">{t("success_rate")}</th>
                        <th className="px-4 py-3 font-medium text-foreground-muted">{t("tried")}</th>
                        <th className="px-4 py-3 font-medium text-foreground-muted">{t("trend")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/[.04] dark:divide-white/[.08]">
                      {data.intervention_effectiveness.map((item, i) => {
                        const isContraindicated = item.success_rate < 20;
                        return (
                          <tr key={i} className={isContraindicated ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                            <td className="px-4 py-3 text-foreground font-medium">
                              {item.intervention}
                              {isContraindicated && (
                                <span className="ml-2 text-xs text-red-600 font-bold">(avoid!)</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-foreground">{item.success_rate}%</td>
                            <td className="px-4 py-3 text-foreground-muted">{item.count}</td>
                            <td className="px-4 py-3 text-foreground">→</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="outline-button h-10 rounded-xl px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? `${t("export_pdf")}…` : t("export_pdf")}
              </button>
              {exportError && (
                <p className="text-sm text-error">{exportError}</p>
              )}
            </div>
          ) : null}
</main>
  );
}
