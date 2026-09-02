import { useTheme } from '@/components/ThemeContext';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import type { PendingFeedback } from '@/lib/api';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

interface HomeFeedbackCardProps {
  pending: PendingFeedback;
  onDismiss: () => void;
  onSubmit: (helpful: boolean, tags: string[], negativeReasons: string[]) => void;
}

export function HomeFeedbackCard({ pending, onDismiss, onSubmit }: HomeFeedbackCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');

  const timeLabel = (isoDate: string): string => {
    const created = new Date(isoDate);
    const now = new Date();
    const hoursAgo = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    if (hoursAgo < 1) return t('feedback.time_just_now');
    if (hoursAgo < 12) return t('feedback.time_hours_ago', { count: hoursAgo });
    if (hoursAgo < 24) return t('feedback.time_earlier_today');
    return t('feedback.time_yesterday');
  };

  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
      }}
    >
      {/* Header */}
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
            {t('feedback.title')}
          </Text>
          <Text
            style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {pending.title.replace(/\.{3}$/, '')} · {timeLabel(pending.created_at)}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel={tc('accessibility.dismiss_feedback')}
        >
          <Text style={{ fontSize: 18, color: colors.mutedForeground }}>✕</Text>
        </Pressable>
      </View>

      {/* Widget */}
      <FeedbackWidget
        conversationId={pending.conversation_id}
        suggestedTags={pending.suggested_tags}
        existingFeedback={null}
        onSubmit={onSubmit}
      />
    </View>
  );
}
