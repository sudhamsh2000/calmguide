import { useTheme } from '@/components/ThemeContext';
import { PREDEFINED_TAGS, TAG_LABELS } from '@/lib/api';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type Severity = 'calm' | 'mild' | 'tough';

const TIME_SLOTS = ['overnight', 'morning', 'afternoon', 'evening'] as const;

interface DailyCheckinCardProps {
  onCheckin: (
    severity: Severity,
    timeSlot?: string,
    tags?: string[],
  ) => Promise<void>;
}

export function DailyCheckinCard({ onCheckin }: DailyCheckinCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');

  const [submitted, setSubmitted] = useState(false);
  const [expanded, setExpanded] = useState<Severity | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const SEVERITY_CONFIG: Array<{
    key: Severity;
    labelKey: string;
    color: string;
    bg: string;
    border: string;
  }> = [
    {
      key: 'calm',
      labelKey: 'daily_checkin.severity_calm',
      color: colors.primary,
      bg: colors.primary + '15',
      border: colors.primary + '40',
    },
    {
      key: 'mild',
      labelKey: 'daily_checkin.severity_mild',
      color: colors.primary,
      bg: colors.primary + '15',
      border: colors.primary + '40',
    },
    {
      key: 'tough',
      labelKey: 'daily_checkin.severity_tough',
      color: colors.primary,
      bg: colors.primary + '15',
      border: colors.primary + '40',
    },
  ];

  const handleSeverityPress = async (severity: Severity) => {
    if (severity === 'calm') {
      setSubmitting(true);
      try {
        await onCheckin('calm');
        setSubmitted(true);
      } finally {
        setSubmitting(false);
      }
    } else {
      setExpanded(severity);
      setSelectedTimeSlot(null);
      setSelectedTags([]);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleDone = async () => {
    if (!expanded) return;
    setSubmitting(true);
    try {
      await onCheckin(
        expanded,
        selectedTimeSlot ?? undefined,
        selectedTags,
      );
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.success + '66',
          backgroundColor: colors.success + '22',
          padding: 16,
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 20 }}>✓</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.success }}>
          {t('daily_checkin.thanks')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
        {t('daily_checkin.title')}
      </Text>

      {/* Severity buttons */}
      {!expanded ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SEVERITY_CONFIG.map((cfg) => (
            <Pressable
              key={cfg.key}
              onPress={() => handleSeverityPress(cfg.key)}
              disabled={submitting}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: cfg.border,
                backgroundColor: cfg.bg,
                minHeight: 44,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed || submitting ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t(cfg.labelKey)}
            >
              <Text style={{ fontSize: 13, fontWeight: '500', color: cfg.color, textAlign: 'center' }}>
                {t(cfg.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {/* Selected severity label */}
          {(() => {
            const cfg = SEVERITY_CONFIG.find((c) => c.key === expanded)!;
            return (
              <View
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: cfg.border,
                  backgroundColor: cfg.bg,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: cfg.color }}>
                  {t(cfg.labelKey)}
                </Text>
              </View>
            );
          })()}

          {/* Time slot */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: '500' }}>
              {t('daily_checkin.when')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TIME_SLOTS.map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() =>
                    setSelectedTimeSlot((prev) => (prev === slot ? null : slot))
                  }
                  style={({ pressed }) => ({
                    borderRadius: 99,
                    borderWidth: 1,
                    borderColor:
                      selectedTimeSlot === slot
                        ? colors.primary
                        : colors.border,
                    backgroundColor:
                      selectedTimeSlot === slot
                        ? colors.primary + '18'
                        : colors.background,
                    paddingHorizontal: 14,
                    minHeight: 44,
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTimeSlot === slot }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: selectedTimeSlot === slot ? '600' : '400',
                      color:
                        selectedTimeSlot === slot
                          ? colors.primary
                          : colors.mutedForeground,
                    }}
                  >
                    {t(`daily_checkin.time_${slot}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Strategy tags */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: '500' }}>
              {t('daily_checkin.what_helped')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PREDEFINED_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={({ pressed }) => ({
                      borderRadius: 99,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primary + '18'
                        : colors.background,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: selected ? '600' : '400',
                        color: selected
                          ? colors.primary
                          : colors.mutedForeground,
                      }}
                    >
                      {TAG_LABELS[tag] ?? tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Done button */}
          <Pressable
            onPress={handleDone}
            disabled={submitting}
            style={({ pressed }) => ({
              borderRadius: 12,
              backgroundColor: colors.primary,
              minHeight: 44,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed || submitting ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={t('daily_checkin.done')}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
              {t('daily_checkin.done')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
