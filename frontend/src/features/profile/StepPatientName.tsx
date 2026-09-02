"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";

export interface StepPatientNameProps {
  patientName: string;
  onChange: (name: string) => void;
  className?: string;
}

export function StepPatientName({
  patientName,
  onChange,
  className = "",
}: StepPatientNameProps) {
  const t = useTranslations("profile");

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("setup.heading")}
        </h2>
        <p className="mt-3 text-base text-foreground-muted leading-relaxed">
          {t("setup.subtitle")}
        </p>
      </div>

      <Input
        label={t("setup.name_label")}
        placeholder={t("setup.name_placeholder")}
        value={patientName}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />

      <div className="card-shell p-4">
        <p className="text-sm text-foreground-muted leading-relaxed">
          {t("setup.name_privacy")}
        </p>
      </div>
    </div>
  );
}
