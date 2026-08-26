"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getAccessCode } from "@/lib/storage";
import { getIncident, updateIncident } from "@/lib/api";
import type { IncidentResponse, IncidentUpdate } from "@/lib/api";

export interface IncidentDetailProps {
  incidentId: string;
  className?: string;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-base text-foreground">{value}</span>
    </div>
  );
}

export function IncidentDetail({ incidentId, className = "" }: IncidentDetailProps) {
  const t = useTranslations("incidents");
  const [incident, setIncident] = useState<IncidentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = getAccessCode();
    if (!code) return;
    setLoading(true);
    getIncident(code, incidentId)
      .then(setIncident)
      .catch(() => setError("Failed to load incident"))
      .finally(() => setLoading(false));
  }, [incidentId]);

  if (loading) {
    return (
      <div className={`flex justify-center py-16 ${className}`}>
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className={`${className}`}>
        <p className="text-base text-error">{error ?? "Incident not found"}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      <Card padding="lg">
        <div className="flex flex-col gap-4">
          <DetailRow label="When" value={formatDate(incident.incident_time)} />
          <DetailRow label="What happened" value={incident.behavior_description} />
          <DetailRow
            label="Severity"
            value={incident.severity ? t(`logger.severity.${incident.severity}`) : null}
          />
          <DetailRow
            label="Duration"
            value={incident.duration_category ? t(`logger.duration.${incident.duration_category}`) : null}
          />
          <DetailRow
            label="What was happening before"
            value={incident.antecedent_description}
          />
          <DetailRow
            label="What was tried"
            value={incident.intervention_description}
          />
          <DetailRow
            label="Outcome"
            value={incident.intervention_outcome ? t(`logger.outcome.${incident.intervention_outcome}`) : null}
          />
          <DetailRow label="Location" value={incident.location} />
          <DetailRow
            label="Source"
            value={incident.source === "auto_extracted" ? t("history.auto_extracted") : t("history.manual")}
          />
          {incident.extraction_confidence !== null && (
            <DetailRow
              label="Extraction confidence"
              value={`${Math.round(incident.extraction_confidence * 100)}%`}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
