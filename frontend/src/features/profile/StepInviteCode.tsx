"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";

export interface StepInviteCodeProps {
  inviteCode: string;
  onChange: (code: string) => void;
  error?: string;
  className?: string;
}

export function StepInviteCode({
  inviteCode,
  onChange,
  error,
  className = "",
}: StepInviteCodeProps) {
  const t = useTranslations("profile");

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold text-primary-dark dark:text-primary-light">
          {t("invite.heading")}
        </h2>
        <p className="mt-3 text-base text-foreground-muted leading-relaxed">
          {t("invite.subtitle")}
        </p>
      </div>

      <Input
        label={t("invite.code_label")}
        placeholder={t("invite.code_placeholder")}
        value={inviteCode}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        error={error}
      />

      <div className="rounded-xl bg-primary/5 dark:bg-primary/8 p-4 border border-primary/12 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <p className="text-sm text-foreground-muted leading-relaxed">
          {t("invite.hint")}
        </p>
      </div>
    </div>
  );
}
