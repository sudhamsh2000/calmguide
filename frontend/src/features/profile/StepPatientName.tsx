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
        <h2 className="text-2xl font-bold text-primary-dark dark:text-primary-light">
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

      <div className="rounded-xl bg-primary/5 dark:bg-primary/8 p-4 border border-primary/12 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <p className="text-sm text-foreground-muted leading-relaxed">
          {t("setup.name_privacy")}
        </p>
      </div>
    </div>
  );
}
