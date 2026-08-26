import { useTheme } from '@/components/ThemeContext';
import { NEGATIVE_REASON_TAGS, PREDEFINED_TAGS } from '@/lib/api';
import type { FeedbackEntry } from '@/lib/api';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

interface FeedbackWidgetProps {
  conversationId: string;
  suggestedTags: string[];
  existingFeedback: FeedbackEntry | null;
  onSubmit: (helpful: boolean, tags: string[], negativeReasons: string[]) => void;
}

function ThumbUpIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 10v12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ThumbDownIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 14V2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6 9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FeedbackWidget({
  conversationId,
  suggestedTags,
  existingFeedback,
  onSubmit,
}: FeedbackWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const tagLabel = (key: string) => tc(`tags.${key}`, { defaultValue: key });
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Read-only state
  if (existingFeedback) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t('feedback.you_rated')}</Text>
        {existingFeedback.helpful ? (
          <ThumbUpIcon color={colors.primary} size={14} />
        ) : (
          <ThumbDownIcon color={colors.error} size={14} />
        )}
      </View>
    );
  }

  // Thank you state
  if (submitted) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <CheckIcon color={colors.primary} />
        <Text style={{ fontSize: 14, color: colors.primary }}>
          {t('feedback.thanks')}
        </Text>
      </View>
    );
  }

  const tags = suggestedTags.length > 0 ? suggestedTags : [...PREDEFINED_TAGS];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason],
    );
  };

  const handleDone = () => {
    if (helpful === null) return;
    onSubmit(helpful, selectedTags, selectedReasons);
    setSubmitted(true);
  };

  return (
    <View style={{ gap: 10 }}>
      {/* Thumbs row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 14, color: colors.foreground }}>{t('feedback.did_this_help')}</Text>
        <Pressable
          onPress={() => { setHelpful(true); setSelectedReasons([]); }}
          style={{
            width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: helpful === true ? colors.primary + '20' : 'transparent',
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: helpful === true }}
          accessibilityLabel={tc('accessibility.helpful')}
        >
          <ThumbUpIcon color={helpful === true ? colors.primary : colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => { setHelpful(false); setSelectedTags([]); }}
          style={{
            width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: helpful === false ? colors.error + '20' : 'transparent',
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: helpful === false }}
          accessibilityLabel={tc('accessibility.not_helpful')}
        >
          <ThumbDownIcon color={helpful === false ? colors.error : colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Tags — thumbs up */}
      {helpful === true && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {t('feedback.what_worked')} <Text style={{ opacity: 0.6 }}>({t('feedback.tap_any')})</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tags.map(tag => {
              const selected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={{
                    borderRadius: 99,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary + '20' : colors.background,
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: '500',
                    color: selected ? colors.primary : colors.mutedForeground,
                  }}>
                    {tagLabel(tag)}{selected ? ' ✓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Tags — thumbs down */}
      {helpful === false && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {t('feedback.what_went_wrong')} <Text style={{ opacity: 0.6 }}>({t('feedback.tap_any')})</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {NEGATIVE_REASON_TAGS.map(reason => {
              const selected = selectedReasons.includes(reason);
              return (
                <Pressable
                  key={reason}
                  onPress={() => toggleReason(reason)}
                  style={{
                    borderRadius: 99,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: selected ? colors.error : colors.border,
                    backgroundColor: selected ? colors.error + '20' : colors.background,
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: '500',
                    color: selected ? colors.error : colors.mutedForeground,
                  }}>
                    {tagLabel(reason)}{selected ? ' ✓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Done button */}
      {helpful !== null && (
        <Pressable
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel={t('feedback.done')}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingHorizontal: 20, paddingVertical: 12,
            alignSelf: 'flex-start',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>{t('feedback.done')}</Text>
        </Pressable>
      )}
    </View>
  );
}
