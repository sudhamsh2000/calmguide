"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";

export type BehavioralStage = "early" | "middle" | "late" | "unknown";

export interface BehavioralAnchorStageProps {
  selectedStage: BehavioralStage | null;
  onSelect: (stage: BehavioralStage) => void;
  className?: string;
}

const BEHAVIORAL_ANCHORS: { stage: BehavioralStage; key: string }[] = [
  { stage: "early", key: "anchor_early" },
  { stage: "middle", key: "anchor_middle" },
  { stage: "late", key: "anchor_late" },
  { stage: "unknown", key: "anchor_unsure" },
];

export function BehavioralAnchorStage({
  selectedStage,
  onSelect,
  className = "",
}: BehavioralAnchorStageProps) {
  const t = useTranslations("profile");

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold text-primary-dark dark:text-primary-light">
          {t("setup.behavioral_stage_heading")}
        </h2>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("disease_stage.label")}>
        {BEHAVIORAL_ANCHORS.map(({ stage, key }) => {
          const isSelected = selectedStage === stage;
          return (
            <Card
              key={stage}
              variant="interactive"
              padding="lg"
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelect(stage)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(stage);
                }
              }}
              className={[
                "min-h-tap transition-all",
                isSelected ? "border-primary/35 bg-primary/[0.06] dark:border-primary/25 dark:bg-primary/[0.09] shadow-[inset_0_0_0_1px_rgba(58,175,169,0.12)]" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected ? "border-primary/70 bg-primary/85 shadow-[0_0_0_3px_rgba(58,175,169,0.06)]" : "border-foreground/30 dark:border-white/12",
                  ].join(" ")}
                >
                  {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(43,122,120,0.32)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" />}
                </div>
                <p className={`text-base leading-relaxed ${isSelected ? "text-primary dark:text-primary-light" : "text-foreground"}`}>
                  {t(`disease_stage.${key}`)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
