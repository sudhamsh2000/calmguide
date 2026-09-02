'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { type DiseaseStage } from './types';

export interface StepDiseaseStageProps {
  selectedStage: DiseaseStage | null;
  onSelect: (stage: DiseaseStage) => void;
  className?: string;
}

const stages: DiseaseStage[] = ['early', 'middle', 'late'];

export function StepDiseaseStage({
  selectedStage,
  onSelect,
  className = '',
}: StepDiseaseStageProps) {
  const t = useTranslations('profile');

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-ink"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('setup.stage_heading')}
        </h2>
        <p className="mt-3 text-base text-foreground-muted leading-relaxed">
          {t('setup.stage_subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('disease_stage.label')}>
        {stages.map((stage) => {
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
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(stage);
                }
              }}
              className={[
                'min-h-tap transition-all',
                isSelected
                  ? 'border-primary/35 bg-primary/[0.06] dark:border-primary/25 dark:bg-primary/[0.09] shadow-[inset_0_0_0_1px_rgba(58,175,169,0.12)]'
                  : '',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'border-primary/70 bg-primary/85 shadow-[0_0_0_3px_rgba(58,175,169,0.06)]'
                      : 'border-foreground/30 dark:border-white/12',
                  ].join(' ')}
                >
                  {isSelected && (
                    <div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(43,122,120,0.32)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" />
                  )}
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold ${isSelected ? 'text-primary dark:text-primary-light' : 'text-foreground'}`}
                  >
                    {t(`disease_stage.${stage}_title`)}
                  </h3>
                  <p className="mt-1 text-sm text-foreground-muted leading-relaxed">
                    {t(`disease_stage.${stage}_description`)}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
