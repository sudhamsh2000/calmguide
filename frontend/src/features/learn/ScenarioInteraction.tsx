"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import ReactMarkdown from "react-markdown";
import type { ComponentProps } from "react";
import { getScenarios, interactWithScenario } from "@/lib/api";
import type { Scenario } from "@/lib/api";
import { useProfile } from "@/context/ProfileContext";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/ui/SpeakButton";
import { MicButton } from "@/components/ui/MicButton";

export interface ScenarioInteractionProps {
  scenarioId: string;
  className?: string;
}

interface FeedbackSection {
  heading: string;
  content: string;
}

function parseFeedback(raw: string): FeedbackSection[] {
  const sections: FeedbackSection[] = [];
  const lines = raw.split("\n");
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(?:\d+\.\s*)?(.+)/);
    if (headingMatch) {
      if (currentHeading && currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentHeading && currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  return sections;
}

const mdComponents: ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-foreground mb-2 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ps-5 space-y-1 text-sm text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ps-5 space-y-1 text-sm text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  h3: ({ children }) => (
    <h3 className="font-semibold text-sm text-foreground mt-3 mb-1">
      {children}
    </h3>
  ),
};

export function ScenarioInteraction({
  scenarioId,
  className = "",
}: ScenarioInteractionProps) {
  const t = useTranslations("learn");
  const tc = useTranslations("common");
  const router = useRouter();
  const { state: profileState } = useProfile();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScenarioLoading(true);
    setScenarioError(null);

    getScenarios()
      .then((scenarios) => {
        if (cancelled) return;
        const found = scenarios.find((s) => s.id === scenarioId);
        if (found) {
          setScenario(found);
        } else {
          setScenarioError(t("error.not_found"));
        }
        setScenarioLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setScenarioError(t("error.load_failed"));
          setScenarioLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setMessage((prev) => prev + (prev ? " " : "") + transcript);
  }, []);

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsVoiceListening(listening);
  }, []);

  async function handleSubmit() {
    if (!message.trim() || !scenario) return;

    setSubmitting(true);
    setSubmitError(null);

    const diseaseStage = profileState.profile?.disease_stage ?? "middle";

    try {
      const result = await interactWithScenario({
        scenario_id: scenarioId,
        disease_stage: diseaseStage,
        message: message.trim(),
      });
      setFeedback(result.response);
    } catch {
      setSubmitError(t("error.feedback_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (scenarioLoading) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-foreground-muted">{t("loading")}</p>
      </div>
    );
  }

  // Error loading scenario
  if (scenarioError || !scenario) {
    return (
      <div className={`flex flex-col gap-4 px-5 py-8 ${className}`}>
        <div
          className="rounded-xl bg-error/10 border border-error/30 p-4"
          role="alert"
        >
          <p className="text-sm text-error">
            {scenarioError ?? "Unable to load this scenario."}
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/learn")}>
          {tc("nav.back_to_scenarios")}
        </Button>
      </div>
    );
  }

  const feedbackSections = feedback ? parseFeedback(feedback) : [];

  return (
    <div className={`flex flex-col gap-5 px-5 pt-5 pb-8 ${className}`}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/learn")}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline min-h-tap"
        aria-label={tc("nav.back_to_scenarios")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        {tc("nav.back_to_scenarios")}
      </button>

      {/* Scenario Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CategoryBadge category={scenario.category} />
          <span className="inline-flex items-center rounded-full bg-foreground/5 px-2.5 py-0.5 text-xs font-medium text-foreground-muted capitalize">
            {t("scenario.stage_label", { stage: t(`scenario.stages.${scenario.disease_stage}`) })}
          </span>
        </div>
        <h1
          className="text-2xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t.has(`scenarios.${scenario.id}.title`) ? t(`scenarios.${scenario.id}.title`) : scenario.title}
        </h1>
      </div>

      {/* Scenario Situation Card */}
      <div className="card-shell rounded-2xl bg-primary/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
          {t("scenario.the_situation")}
        </p>
        <p className="text-base text-foreground leading-relaxed">
          {t.has(`scenarios.${scenario.id}.description`) ? t(`scenarios.${scenario.id}.description`) : scenario.description}
        </p>
      </div>

      {/* Response Area */}
      {!feedback && (
        <div className="flex flex-col gap-3">
          <label
            htmlFor="caregiver-response"
            className="text-sm font-semibold text-foreground"
          >
            {t("scenario.your_response")}
          </label>
          <div className="relative">
            <textarea
              id="caregiver-response"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isVoiceListening ? "" : t("scenario.response_placeholder")}
              rows={5}
              className={[
                "field-shell w-full px-4 py-3 pb-10 text-base resize-none",
                isVoiceListening
                  ? "field-shell-error ring-2 ring-error/20"
                  : "",
              ].join(" ")}
            />
            {isVoiceListening && !message && (
              <div className="absolute top-3 start-4 end-4 pointer-events-none">
                <p className="text-base text-error/60 animate-pulse">
                  {tc("actions.speak_now")}
                </p>
              </div>
            )}
            <div className="absolute bottom-2 end-2 flex items-center gap-2">
              {isVoiceListening && (
                <div className="flex items-center gap-1.5 text-error" aria-live="polite">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error/75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                  </span>
                  <span className="text-xs font-medium">Listening...</span>
                </div>
              )}
              <MicButton
                onTranscript={handleVoiceTranscript}
                onListeningChange={handleListeningChange}
                disabled={submitting}
              />
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!message.trim() || submitting}
            loading={submitting}
            className="w-full"
          >
            {submitting ? t("scenario.getting_feedback") : t("scenario.get_feedback")}
          </Button>
          <p className="text-xs text-foreground-muted/70 text-center leading-relaxed">
            {tc("privacy_hint")}
          </p>
        </div>
      )}

      {/* Submit Error */}
      {submitError && (
        <div
          className="rounded-xl bg-error/10 border border-error/30 p-4"
          role="alert"
        >
          <p className="text-sm text-error">{submitError}</p>
        </div>
      )}

      {/* Feedback Display */}
      {feedback && (
        <div className="flex flex-col gap-3">
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("scenario.your_feedback")}
          </h2>

          {feedbackSections.length > 0 ? (
            feedbackSections.map((section) => (
              <div
                key={section.heading}
                className="rounded-2xl border border-foreground/10 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-primary mb-1.5">
                    {section.heading}
                  </p>
                  <SpeakButton text={section.content} className="shrink-0" />
                </div>
                <div className="space-y-2">
                  <ReactMarkdown components={mdComponents}>
                    {section.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-foreground/10 bg-surface p-4">
              <div className="flex justify-end mb-2">
                <SpeakButton text={feedback} />
              </div>
              <div className="space-y-2">
                <ReactMarkdown components={mdComponents}>
                  {feedback}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Try Another Response */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setFeedback(null);
                setMessage("");
                setSubmitError(null);
              }}
              className="w-full"
            >
              {t("scenario.try_different")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/learn")}
              className="w-full"
            >
              {tc("nav.back_to_scenarios")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
