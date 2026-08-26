"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { getAccessCode } from "@/lib/storage";
import { getPatterns } from "@/lib/api";
import type { PatternResponse } from "@/lib/api";

export interface PatternInsightsDetailProps {
  className?: string;
}

export function PatternInsightsDetail({ className = "" }: PatternInsightsDetailProps) {
  const t = useTranslations("incidents");
  const [patterns, setPatterns] = useState<PatternResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = getAccessCode();
    if (!code) return;
    getPatterns(code)
      .then(setPatterns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`flex justify-center py-16 ${className}`}>
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!patterns) return null;

  const trends = patterns.frequency_trends as Record<string, { current_weekly?: number; direction?: string }>;
  const effective = patterns.effective_interventions as Array<{ intervention?: string; count?: number }>;
  const contra = patterns.contraindicated as Array<{ description?: string }>;

  return (
    <div className={`flex flex-col gap-5 px-5 pt-5 pb-8 ${className}`}>
      <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "var(--font-display)" }}>
        {t("patterns.title")}
      </h1>

      {/* Frequency trends */}
      {Object.keys(trends).length > 0 && (
        <Card padding="md">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
            {t("patterns.frequency")}
          </p>
          <div className="flex flex-col gap-2">
            {Object.entries(trends).map(([cat, data]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-base text-foreground capitalize">{cat.replace(/_/g, " ")}</span>
                <span className="text-sm font-medium text-foreground-muted">
                  {data.current_weekly ?? 0}/wk
                  {data.direction === "increasing" && " ↑"}
                  {data.direction === "decreasing" && " ↓"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Effective interventions */}
      {effective.length > 0 && (
        <Card padding="md">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
            {t("patterns.what_works")}
          </p>
          <div className="flex flex-col gap-2">
            {effective.map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-base text-foreground">{e.intervention ?? "Unknown"}</span>
                <span className="text-sm font-medium text-[#3A7D5C]">{e.count ?? 0}x</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contraindicated */}
      {contra.length > 0 && (
        <Card padding="md">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
            {t("patterns.what_doesnt")}
          </p>
          <div className="flex flex-col gap-2">
            {contra.map((c, i) => (
              <p key={i} className="text-base text-foreground">{c.description ?? ""}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Escalation pattern */}
      {patterns.escalation_pattern && (
        <Card padding="md">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">
            Escalation pattern
          </p>
          <p className="text-base text-foreground">{patterns.escalation_pattern}</p>
        </Card>
      )}
    </div>
  );
}
