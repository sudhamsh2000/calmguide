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
  const hasStickyPrimaryAction = pathname === '/login' || pathname === '/profile/setup';
  const bottomOffset = insets.bottom + (isTabRoute ? 68 : hasStickyPrimaryAction ? 92 : 14);

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
          style={({ pressed }) => ({
            minHeight: 52,
            minWidth: 52,
            borderRadius: 26,
            backgroundColor: colors.error,
            paddingHorizontal: 16,
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
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>
            {t('emergency.label', 'Emergency')}
          </Text>
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
