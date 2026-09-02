'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface StepChipSelectorProps {
  title: string;
  description: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Options group key under profile.options — used to translate chip labels (e.g. 'behavioral', 'calming', 'safety') */
  group: 'behavioral' | 'calming' | 'safety';
  className?: string;
}

export function StepChipSelector({
  title,
  description,
  options,
  selected,
  onChange,
  group,
  className = '',
}: StepChipSelectorProps) {
  const t = useTranslations('profile');
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  function handleToggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  function handleAddCustom() {
    const trimmed = customValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomValue('');
    setShowCustomInput(false);
  }

  // Custom items are those in selected but not in the predefined options
  const customItems = selected.filter(
    (item) => !options.includes(item),
  );

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        <p className="mt-3 text-base text-foreground-muted leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="listbox" aria-multiselectable="true" aria-label={title}>
        {options.map((option) => (
          <Chip
            key={option}
            label={t(`options.${group}.${option}`, { defaultValue: option })}
            selected={selected.includes(option)}
            onToggle={() => handleToggle(option)}
          />
        ))}
        {customItems.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={true}
            onToggle={() => handleToggle(item)}
          />
        ))}
      </div>

      {showCustomInput ? (
        <div className="flex gap-2 items-end">
          <Input
            label={t('chip.add_your_own')}
            placeholder={t('chip.type_here')}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            className="flex-1"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleAddCustom}
            disabled={!customValue.trim()}
          >
            {t('chip.add')}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setShowCustomInput(false);
              setCustomValue('');
            }}
          >
            {t('chip.cancel')}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustomInput(true)}
          className="self-start text-primary font-medium text-base hover:underline focus-ring rounded min-h-tap flex items-center cursor-pointer"
        >
          {t('chip.add_custom')}
        </button>
      )}
    </div>
  );
}
