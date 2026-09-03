import { usePathname, useSegments } from 'expo-router';
import { useState } from 'react';
import { I18nManager, Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

function call(number: string) {
  Linking.openURL(`tel:${number}`).catch(() => {});
}

export function EmergencyBar() {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const isTabRoute = segments.includes('(tabs)');
  // Every route with its own fixed bottom input/action bar needs the larger
  // offset, or the FAB sits on top of it — on /coach this covered the Send
  // button badly enough to intercept its taps, not just look bad.
  const hasStickyPrimaryAction =
    pathname === '/login' || pathname === '/profile/setup' || pathname === '/coach';
  // The welcome screen ends in the Leap of Faith partner band. Without its own
  // offset this button lands squarely on top of the partner logo, which is the
  // one thing on that screen that must not be obscured.
  const hasPartnerBand = pathname === '/';
  const bottomOffset =
    insets.bottom + (isTabRoute ? 68 : hasStickyPrimaryAction ? 118 : hasPartnerBand ? 80 : 14);

  function handleCall(number: string) {
    setExpanded(false);
    call(number);
  }

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          ...(I18nManager.isRTL ? { left: 16 } : { right: 16 }),
          bottom: bottomOffset,
        }}
      >
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={t('emergency.label', 'Emergency contacts')}
          hitSlop={4}
          // A standard-size circular FAB (52dp), not a labeled pill. The pill
          // was ~370px wide and, being an absolutely-positioned overlay with no
          // awareness of what's beneath it, regularly covered real content —
          // list card text, form fields — on any screen with enough content to
          // reach the bottom-right corner. A FAB-sized circle still covers
          // something in that corner, but only a small fixed patch of it,
          // which is the standard tradeoff for a persistent floating control.
          style={({ pressed }) => ({
            height: 52,
            width: 52,
            borderRadius: 26,
            backgroundColor: colors.error,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.error + 'CC',
            opacity: pressed ? 0.88 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.16,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          })}
        >
          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 24, lineHeight: 26 }}>!</Text>
        </Pressable>
      </View>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <Pressable
          onPress={() => setExpanded(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.28)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessible
            accessibilityLabel={t('emergency.label', 'Emergency contacts')}
            onPress={() => {}}
            style={{
              marginHorizontal: 16,
              marginBottom: insets.bottom + 16,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>
              {t('emergency.label', 'Emergency contacts')}
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20 }}>
              {t('emergency.choose_option')}
            </Text>

            <Pressable
              onPress={() => handleCall('911')}
              accessibilityRole="link"
              accessibilityLabel={t('emergency.call_911', 'Call 911')}
              style={({ pressed }) => ({
                minHeight: 44,
                borderRadius: 14,
                backgroundColor: colors.error,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>911</Text>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
                {t('emergency.emergency_services')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleCall('988')}
              accessibilityRole="link"
              accessibilityLabel={t('emergency.call_988', 'Call 988 Suicide and Crisis Lifeline')}
              style={({ pressed }) => ({
                minHeight: 44,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.error + '66',
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.error + '10',
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text style={{ color: colors.error, fontSize: 16, fontWeight: '700' }}>988</Text>
              <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>
                {t('emergency.crisis_line', '988 Crisis Line')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleCall('18002723900')}
              accessibilityRole="link"
              accessibilityLabel={t('emergency.call_alz', "Call Alzheimer's Association Helpline")}
              style={({ pressed }) => ({
                minHeight: 44,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.primary + '66',
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.primary + '10',
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>24/7</Text>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>
                {t('emergency.alz_helpline', 'Alz Helpline')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
