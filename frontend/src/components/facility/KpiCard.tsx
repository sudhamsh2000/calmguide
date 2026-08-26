"use client";

type Urgency = "alert" | "warning" | "positive";

interface KpiCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
  urgency?: Urgency;
  className?: string;
}

const TREND_ICONS: Record<string, { arrow: string; color: string }> = {
  up: { arrow: "↑", color: "text-red-600 dark:text-red-400" },
  down: { arrow: "↓", color: "text-green-600 dark:text-green-400" },
  neutral: { arrow: "→", color: "text-foreground-muted" },
};

const URGENCY_STYLES: Record<Urgency, { card: string; value: string }> = {
  alert: {
    card: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30",
    value: "text-red-700 dark:text-red-400",
  },
  warning: {
    card: "border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30",
    value: "text-orange-700 dark:text-orange-400",
  },
  positive: {
    card: "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30",
    value: "text-green-700 dark:text-green-400",
  },
};

export function KpiCard({ value, label, sublabel, trend, urgency, className = "" }: KpiCardProps) {
  const t = trend ? TREND_ICONS[trend] : null;
  const u = urgency ? URGENCY_STYLES[urgency] : null;

  return (
    <div
      className={`rounded-xl border ${u ? u.card : "border-foreground/10 bg-surface"} px-4 py-4 ${className}`}
      style={{ textAlign: "start" }}
    >
      <p className={`text-2xl font-bold leading-none flex items-center gap-2 ${u ? u.value : "text-foreground"}`}>
        {value}
        {t && <span className={`text-base ${t.color}`}>{t.arrow}</span>}
      </p>
      <p className="text-sm font-medium text-foreground mt-1">{label}</p>
      {sublabel && (
        <p className="text-xs text-foreground-muted mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}
