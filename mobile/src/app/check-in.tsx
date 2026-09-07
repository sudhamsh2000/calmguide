import { BreathingIndicator } from '@/components/BreathingIndicator';
import { Button } from '@/components/Button';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { MicButton } from '@/components/MicButton';
import { useTheme } from '@/components/ThemeContext';
import { streamCheckIn } from '@/lib/api';
import { getAccessCode, getAutoSpeakReplies, getPatientName } from '@/lib/storage';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useNetworkStatus } from '@/lib/network';
import { OfflineBanner } from '@/components/OfflineBanner';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type Phase = 'input' | 'streaming' | 'done';

export default function CheckInScreen() {
  return (
    <MedicalDisclaimer>
      <CheckInScreenInner />
    </MedicalDisclaimer>
  );
}

function CheckInScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation('checkin');
  const { t: tc } = useTranslation('common');
  const [phase, setPhase] = useState<Phase>('input');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [accessCode, setAccessCodeState] = useState('');
  const [patientName, setPatientNameState] = useState('Patient');
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const { isOnline } = useNetworkStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const { speak } = useSpeechSynthesis({ locale: i18n.language });
  // The onDone callback below is created fresh each handleShare() call but
  // only closes over `response` as it was at call time, not as it ends up
  // after streaming — mirrors rawRef in coach.tsx for the same reason.
  const responseRef = useRef('');

  useEffect(() => {
    getAccessCode().then((c) => setAccessCodeState(c ?? ''));
    getPatientName().then((n) => setPatientNameState(n ?? 'Patient'));
    return () => {
      abortRef.current?.();
    };
  }, []);

  const handleShare = useCallback(() => {
    if (!message.trim() || !accessCode) return;
    setPhase('streaming');
    setResponse('');
    responseRef.current = '';
    setError('');

    abortRef.current = streamCheckIn(
      {
        access_code: accessCode,
        patient_name: patientName.trim() || 'Patient',
        message: message.trim(),
      },
      (chunk) => {
        responseRef.current += chunk;
        setResponse((prev) => prev + chunk);
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      () => {
        setPhase('done');
        AccessibilityInfo.announceForAccessibility('Response is ready');
        scrollRef.current?.scrollToEnd({ animated: true });
        getAutoSpeakReplies().then((enabled) => {
          if (enabled && responseRef.current.trim()) speak(responseRef.current);
        });
      },
      () => {
        setPhase('done');
        setError(
          isOnlineRef.current === false ? tc('network.offline_detail') : tc('error.connection'),
        );
      },
    );
  }, [message, accessCode, patientName, tc, speak]);

  function handleReset() {
    abortRef.current?.();
    setPhase('input');
    setMessage('');
    setResponse('');
    setError('');
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('title'),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '600', color: colors.foreground },
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            gap: 20,
            paddingBottom: 40 + (Platform.OS === 'android' ? insets.bottom : 0),
          }}
        >
          {/* Header */}
          <View style={{ gap: 2 }}>
            <Text
              style={{ fontSize: 20, fontWeight: '500', color: colors.foreground, lineHeight: 26 }}
            >
              {t('title')}
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('subtitle')}</Text>
          </View>

          <OfflineBanner />

          {/* Input area — hide after submission */}
          {phase === 'input' && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    padding: 16,
                    fontSize: 16,
                    color: colors.foreground,
                    minHeight: 150,
                    textAlignVertical: 'top',
                    lineHeight: 24,
                  }}
                  placeholder={
                    isListening && !message ? tc('actions.speak_now') : t('input_placeholder')
                  }
                  placeholderTextColor={colors.mutedForeground + '88'}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  autoFocus
                  accessibilityLabel={t('input_aria_label')}
                />
                <MicButton
                  onTranscript={(text) => setMessage((prev) => (prev ? prev + ' ' + text : text))}
                  onListeningChange={setIsListening}
                  onSpeechEnd={handleShare}
                />
              </View>
              {isListening && (
                <View
                  accessibilityRole="text"
                  accessibilityLiveRegion="polite"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }}
                  />
                  <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600' }}>
                    {tc('actions.speak_now')}
                  </Text>
                </View>
              )}
              <Button
                size="lg"
                variant="primary"
                disabled={!message.trim()}
                onPress={handleShare}
                style={{ minHeight: 52 }}
              >
                {t('submit_button')}
              </Button>
            </View>
          )}

          {/* Streaming / loading */}
          {phase === 'streaming' && !response && (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            >
              <BreathingIndicator size={20} />
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('loading')}</Text>
            </View>
          )}

          {/* Streamed response */}
          {response ? (
            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 20,
                paddingVertical: 20,
              }}
            >
              <Text style={{ fontSize: 16, color: colors.foreground, lineHeight: 25 }}>
                {response}
              </Text>
            </View>
          ) : null}

          {/* Done state */}
          {phase === 'done' && (
            <View style={{ gap: 10 }}>
              <Button size="lg" variant="primary" onPress={() => router.back()}>
                {t('back_to_home')}
              </Button>
              <Button size="md" variant="ghost" onPress={handleReset}>
                {t('submit_button')}
              </Button>
            </View>
          )}

          {/* Error */}
          {error ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{
                backgroundColor: colors.error + '14',
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.error + '33',
              }}
            >
              <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
              <Pressable
                onPress={() => {
                  setError('');
                  setPhase('input');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('start_over')}
                style={{
                  marginTop: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  minHeight: 44,
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' }}
                >
                  {t('start_over')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
