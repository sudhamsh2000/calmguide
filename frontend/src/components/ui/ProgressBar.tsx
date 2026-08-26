export interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  progressText?: string;
  stepLabels?: string[];
  className?: string;
}

const DEFAULT_LABELS = ['Name', 'Stage', 'Behaviors', 'Calming', 'Safety'];

export function ProgressBar({
  currentStep,
  totalSteps,
  progressText = `Step ${currentStep} of ${totalSteps}`,
  stepLabels = DEFAULT_LABELS,
  className = '',
}: ProgressBarProps) {
  const labels = stepLabels.length >= totalSteps ? stepLabels : DEFAULT_LABELS;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-sm font-display text-foreground-muted" aria-live="polite">
        {progressText}
      </p>
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              data-testid={`progress-segment-${i + 1}`}
              className={[
                'h-2.5 w-full rounded-full transition-colors',
                i < currentStep ? 'bg-primary' : 'bg-[rgba(43,122,120,0.25)]',
              ].join(' ')}
            />
            <span
              className={[
                'text-[10px] leading-tight transition-colors',
                i + 1 === currentStep
                  ? 'text-primary font-semibold'
                  : i < currentStep
                    ? 'text-foreground-muted'
                    : 'text-foreground-muted/50',
              ].join(' ')}
            >
              {labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
