import { getTranslations } from "next-intl/server";
import { IncidentHistory } from "@/features/incidents/IncidentHistory";
import { BackButton } from "@/components/ui/BackButton";

export default async function IncidentsPage() {
  const t = await getTranslations("incidents");
  const tc = await getTranslations("common");

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-4">
        <BackButton href="/home" label={tc("nav.back_to_home")} />
        <h1 className="text-xl font-medium text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          {t("history.title")}
        </h1>
      </div>
      <IncidentHistory />
    </main>
  );
}
