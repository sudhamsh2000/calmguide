import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { localeNumbers } from './SafetyDisclosure';

/**
 * Full-screen red alert shown when the safety gate returns an EMERGENCY
 * decision — the mobile twin of the web EmergencyAlert. Deliberately louder
 * than the rest of the app, which is otherwise built to stay calm.
 *
 * - The attention cue is a single warning haptic, not a sound. It plays in a
 *   house where someone has dementia, often at night; a siren risks startling
 *   the patient and escalating the very situation the caregiver asked about.
 * - Dismissal is deliberate: no tap-outside-to-close, so an accidental tap
 *   cannot clear a 911 prompt. The Android back button still closes it.
 * - The number comes from `localeNumbers`, so a Hindi caregiver sees 112.
 */
export function EmergencyAlert({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const { t, i18n } = useTranslation('coach');
  const numbers = localeNumbers(i18n.language);

  useEffect(() => {
    if (!open) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [open]);

  const callLabel = t('emergency_alert.call', { number: numbers.emergency });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(28, 8, 4, 0.62)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 28,
            backgroundColor: '#B3261E',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.28)',
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: 24,
            alignItems: 'center',
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: '800',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            {t('emergency_alert.title')}
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 16,
              lineHeight: 22,
              textAlign: 'center',
              marginBottom: 22,
            }}
          >
            {t('emergency_alert.body')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={callLabel}
            onPress={() => {
              Linking.openURL(`tel:${numbers.emergency.replace(/[^+\d]/g, '')}`).catch(() => {});
            }}
            style={({ pressed }) => ({
              alignSelf: 'stretch',
              minHeight: 60,
              borderRadius: 30,
              backgroundColor: pressed ? '#F3E3E0' : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            })}
          >
            <Text style={{ color: '#B3261E', fontSize: 20, fontWeight: '800' }}>{callLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('emergency_alert.dismiss')}
            onPress={onDismiss}
            style={{ minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, textDecorationLine: 'underline' }}>
              {t('emergency_alert.dismiss')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
