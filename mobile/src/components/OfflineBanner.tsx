import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import { useNetworkStatus } from '@/lib/network';

/**
 * Persistent banner shown while the device is known to be offline (P2-12
 * degraded-mode scaffolding). Renders nothing when online or while
 * connectivity is still being determined (isOnline === null) — see
 * useNetworkStatus's docstring for why unknown state is treated as online.
 *
 * This only surfaces the offline state; it does not queue or retry
 * requests. Screens using it should still show their own error copy
 * (distinguishing offline vs. server error) when a request actually fails.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { t } = useTranslation('common');

  if (isOnline !== false) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.mutedForeground + '1a',
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 14,
        borderStartWidth: 4,
        borderStartColor: colors.mutedForeground,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground }}>
        {t('network.offline_banner')}
      </Text>
      <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>
        {t('network.offline_detail')}
      </Text>
    </View>
  );
}
