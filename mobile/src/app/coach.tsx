import { SafetyDisclosure } from '@/components/SafetyDisclosure';
import { BreathingIndicator } from '@/components/BreathingIndicator';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { MicButton } from '@/components/MicButton';
import { SpeakButton } from '@/components/SpeakButton';
import { useTheme } from '@/components/ThemeContext';
import { streamCoachChat, getConversationMessages } from '@/lib/api';
import { ResidentContextBanner } from '@/components/facility/ResidentContextBanner';
import { MarkdownText } from '@/components/MarkdownText';
import { parseCoachResponse, type CoachSection, type CoachSectionId } from '@/lib/parse-response';
import { getAccessCode, getAutoSpeakReplies, getPatientName } from '@/lib/storage';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useNetworkStatus } from '@/lib/network';
import { OfflineBanner } from '@/components/OfflineBanner';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  I18nManager,
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

interface ChatExchange {
  userMessage: string;
  response: string;
  sections: CoachSection[];
}

const SECTION_STYLES: Record<
  CoachSectionId,
  {
    bg: string;
    borderColor: string;
    borderLeft?: boolean;
    labelColor: string;
    labelKey: string;
  }
> = {
  'right-now': {
    bg: 'primary',
    borderColor: 'primary',
    labelColor: 'primaryDark',
    labelKey: 'sections.right_now',
  },
  why: { bg: 'surface', borderColor: 'border', labelColor: 'foreground', labelKey: 'sections.why' },
  'what-not-to-do': {
    bg: 'surface',
    borderColor: 'border',
    borderLeft: true,
    labelColor: 'error',
    labelKey: 'sections.what_not_to_do',
  },
  escalation: {
    bg: 'surface',
    borderColor: 'border',
    labelColor: 'mutedForeground',
    labelKey: 'sections.escalation',
  },
};

function SectionCardComponent({ section }: { section: CoachSection }) {
  const { colors } = useTheme();
  const { t } = useTranslation('coach');
  const style = SECTION_STYLES[section.id];
  const isRightNow = section.id === 'right-now';
  const isWhatNot = section.id === 'what-not-to-do';

  return (
    <View
      style={{
        borderRadius: 18,
        borderCurve: 'continuous',
        padding: 18,
        gap: 8,
        backgroundColor: isRightNow ? colors.primary + '14' : colors.surface,
        borderWidth: isWhatNot ? 1 : isRightNow ? 2 : 1,
        borderColor: isRightNow ? colors.primary : colors.border,
        ...(isWhatNot ? { borderStartWidth: 4, borderStartColor: colors.error } : {}),
      }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 14,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: isRightNow
              ? colors.primaryDark
              : isWhatNot
                ? colors.error
                : colors.mutedForeground,
          }}
        >
          {t(style.labelKey)}
        </Text>
        <SpeakButton text={section.content} />
      </View>
      <MarkdownText baseSize={15} lineHeight={23}>
        {section.content}
      </MarkdownText>
    </View>
  );
}

/**
 * Memoized: completed sections in conversation history keep a stable `section`
 * object reference, so they skip re-render while the in-progress section
 * streams (MOBPERF-14). Re-renders only when the section's id/content changes.
 */
const SectionCard = React.memo(SectionCardComponent);

function SectionRenderer({
  sections,
  rawResponse,
}: {
  sections: CoachSection[];
  rawResponse: string;
}) {
  const { colors } = useTheme();

  if (sections.length > 0) {
    return (
      <View style={{ gap: 12 }}>
        {sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </View>
    );
  }

  if (rawResponse.trim()) {
    return (
      <Card variant="default" padding={16}>
        <MarkdownText baseSize={15} lineHeight={24}>
          {rawResponse}
        </MarkdownText>
      </Card>
    );
  }

  return null;
}

function GreetingCard() {
  const { colors } = useTheme();
  const { t } = useTranslation('coach');
  return (
    <View
      style={{
        backgroundColor: colors.primary + '0D',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.primary + '33',
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 17, color: colors.foreground, lineHeight: 26 }}>
        {t('greeting')}{' '}
        <Text style={{ color: colors.mutedForeground }}>{t('greeting_detail')}</Text>
      </Text>
    </View>
  );
}

function UserMessageBubble({ message }: { message: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation('coach');
  return (
    <View
      style={{
        backgroundColor: colors.foreground + '12',
        borderStartWidth: 4,
        borderStartColor: colors.primary,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: colors.mutedForeground,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 4,
        }}
      >
        {t('you_asked')}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: '500', color: colors.foreground, lineHeight: 24 }}>
        {message}
      </Text>
    </View>
  );
}

export default function CoachScreen() {
  return (
    <MedicalDisclaimer>
      <CoachScreenInner />
    </MedicalDisclaimer>
  );
}

function CoachScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation('coach');
  const { t: tc } = useTranslation('common');
  const { speak } = useSpeechSynthesis({ locale: i18n.language });
  const {
    session_id: initialSessionId,
    profile_id,
    unit,
    room,
    bed,
    risk,
  } = useLocalSearchParams<{
    session_id?: string;
    profile_id?: string;
    unit?: string;
    room?: string;
    bed?: string;
    risk?: string;
  }>();
  const isFacilityMode = !!profile_id;
  const [showInitial, setShowInitial] = useState(!initialSessionId);
  const [inputText, setInputText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [rawResponse, setRawResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [history, setHistory] = useState<ChatExchange[]>([]);
  const [accessCode, setAccessCodeState] = useState('');
  const [patientName, setPatientNameState] = useState('Patient');
  const { isOnline } = useNetworkStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const rawRef = useRef('');
  const lastAttemptedRef = useRef('');
  // Throttle UI flushes: the SSE reader delivers ~40 chunks/s, but re-parsing
  // and re-rendering on every chunk drops frames (MOBPERF-4). We accumulate raw
  // text in rawRef and flush setRawResponse at most every FLUSH_INTERVAL_MS.
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isFacilityMode) {
      setAccessCodeState('facility-mode');
      setPatientNameState('Resident');
    } else {
      Promise.all([getAccessCode(), getPatientName()]).then(([code, name]) => {
        setAccessCodeState(code ?? '');
        setPatientNameState(name ?? 'Patient');

        // Load past messages when resuming a session
        if (initialSessionId && code) {
          getConversationMessages(code, initialSessionId)
            .then((messages) => {
              const exchanges: ChatExchange[] = [];
              for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                if (msg.role === 'user') {
                  const next = messages[i + 1];
                  if (next?.role === 'assistant') {
                    exchanges.push({
                      userMessage: msg.content,
                      response: next.content,
                      sections: parseCoachResponse(next.content),
                    });
                    i++;
                  }
                }
              }
              setHistory(exchanges);
            })
            .catch(() => {});
        }
      });
    }
    return () => {
      abortRef.current?.();
      cancelPendingFlush();
    };
  }, [isFacilityMode, cancelPendingFlush]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim() || (!accessCode && !isFacilityMode)) return;
      lastAttemptedRef.current = message;
      setCurrentMessage(message);
      setShowInitial(false);
      setIsStreaming(true);
      setStreamError('');
      setRawResponse('');
      rawRef.current = '';
      cancelPendingFlush();

      const FLUSH_INTERVAL_MS = 150;
      const scheduleFlush = () => {
        if (flushTimerRef.current !== null) return; // a flush is already pending
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          setRawResponse(rawRef.current);
          scrollRef.current?.scrollToEnd({ animated: true });
        }, FLUSH_INTERVAL_MS);
      };

      const safePatientName = patientName.trim() || 'Patient';
      abortRef.current = streamCoachChat(
        isFacilityMode
          ? { profile_id: profile_id!, patient_name: safePatientName, message: message.trim() }
          : { access_code: accessCode, patient_name: safePatientName, message: message.trim() },
        (chunk) => {
          rawRef.current += chunk;
          scheduleFlush();
        },
        () => {
          cancelPendingFlush();
          setIsStreaming(false);
          const finalRaw = rawRef.current;
          const parsed = parseCoachResponse(finalRaw);
          setHistory((h) => [
            ...h,
            { userMessage: message.trim(), response: finalRaw, sections: parsed },
          ]);
          setCurrentMessage('');
          setRawResponse('');
          rawRef.current = '';
          getAutoSpeakReplies().then((enabled) => {
            if (enabled && finalRaw.trim()) speak(finalRaw);
          });
          AccessibilityInfo.announceForAccessibility('Guidance is ready');
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        },
        (err) => {
          cancelPendingFlush();
          setIsStreaming(false);
          setRawResponse('');
          rawRef.current = '';
          // A known-offline device almost certainly failed because of that, not
          // a server-side problem — say so, since "we can't connect" reads very
          // differently from "check your own connection" to a stressed caregiver.
          setStreamError(
            isOnlineRef.current === false
              ? tc('network.offline_detail')
              : err.message.includes('422')
                ? t('error.profile_not_found')
                : t('error.server_error'),
          );
        },
      );
    },
    [accessCode, isFacilityMode, profile_id, patientName, t, cancelPendingFlush, speak],
  );

  const currentSections = useMemo(() => parseCoachResponse(rawResponse), [rawResponse]);

  // Auto-submit handlers for the mic buttons' onSpeechEnd — fires once
  // recognition truly finishes, mirroring the web CoachInput/CoachFooterInput
  // handleSubmit wired to MicButton's onSpeechEnd.
  const handleInitialSubmit = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  }, [inputText, sendMessage]);

  const handleFooterSubmit = useCallback(() => {
    if (!footerText.trim() || isStreaming) return;
    sendMessage(footerText);
    setFooterText('');
  }, [footerText, isStreaming, sendMessage]);

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isFacilityMode && (
          <ResidentContextBanner
            unit={unit ?? null}
            room={room ?? null}
            bed={bed ?? null}
            riskLevel={(risk as 'high' | 'moderate' | 'low') ?? 'low'}
          />
        )}
        <ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 24 }}
        >
          <SafetyDisclosure />
          <OfflineBanner />
          {/* Phase 1: initial input */}
          {showInitial && (
            <>
              <GreetingCard />
              <View style={{ gap: 12 }}>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      padding: 16,
                      paddingBottom: 56,
                      fontSize: 17,
                      color: colors.foreground,
                      minHeight: 130,
                      textAlignVertical: 'top',
                      textAlign: I18nManager.isRTL ? 'right' : 'left',
                      writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
                      lineHeight: 25,
                    }}
                    placeholder={t('input_placeholder')}
                    placeholderTextColor={colors.mutedForeground + '88'}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    autoFocus
                    accessibilityLabel={t('input_aria_label')}
                    accessibilityHint={t('subtitle')}
                  />
                  <View style={{ position: 'absolute', bottom: 10, end: 10 }}>
                    <MicButton
                      onTranscript={(t) => setInputText((prev) => (prev ? prev + ' ' + t : t))}
                      onSpeechEnd={handleInitialSubmit}
                    />
                  </View>
                </View>
                <Button
                  size="lg"
                  variant="primary"
                  disabled={!inputText.trim()}
                  onPress={handleInitialSubmit}
                  style={{ minHeight: 56 }}
                >
                  {t('submit_button')}
                </Button>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.mutedForeground,
                    textAlign: 'center',
                    lineHeight: 18,
                    opacity: 0.8,
                  }}
                >
                  {tc('privacy_hint')}
                </Text>
              </View>
            </>
          )}

          {/* Conversation history */}
          {history.map((exchange, i) => (
            <View key={i} style={{ gap: 12 }}>
              <UserMessageBubble message={exchange.userMessage} />
              <SectionRenderer sections={exchange.sections} rawResponse={exchange.response} />
            </View>
          ))}

          {/* Error state */}
          {streamError ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{
                backgroundColor: colors.error + '14',
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 16,
                borderStartWidth: 4,
                borderStartColor: colors.error,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.error }}>
                {t('error.something_wrong')}
              </Text>
              <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
                {streamError}
              </Text>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setStreamError('');
                  sendMessage(lastAttemptedRef.current);
                }}
              >
                {tc('actions.try_again', { defaultValue: 'Try Again' })}
              </Button>
            </View>
          ) : null}

          {/* Current streaming message */}
          {currentMessage ? (
            <View style={{ gap: 12 }}>
              <UserMessageBubble message={currentMessage} />
              {isStreaming && currentSections.length === 0 && !rawResponse && (
                <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                  <BreathingIndicator size={36} />
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.mutedForeground,
                      marginTop: 8,
                      textAlign: 'center',
                    }}
                  >
                    {t('finding_guidance')}
                  </Text>
                </View>
              )}
              <SectionRenderer sections={currentSections} rawResponse={rawResponse} />
              {isStreaming && currentSections.length > 0 && (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  accessibilityRole="text"
                  accessibilityLiveRegion="polite"
                >
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.primary,
                    }}
                  />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                    {t('still_working')}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky footer input (phase 2) */}
        {!showInitial && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 10 + insets.bottom,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 10,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 24,
                paddingStart: 14,
                paddingEnd: 4,
                paddingVertical: 4,
                gap: 4,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.foreground,
                  maxHeight: 100,
                  paddingVertical: 8,
                  lineHeight: 22,
                  textAlign: I18nManager.isRTL ? 'right' : 'left',
                  writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
                }}
                placeholder={t('followup_placeholder')}
                placeholderTextColor={colors.mutedForeground + '88'}
                value={footerText}
                onChangeText={setFooterText}
                multiline
                accessibilityLabel={t('followup_aria_label')}
              />
              <MicButton
                onTranscript={(t) => setFooterText((prev) => (prev ? prev + ' ' + t : t))}
                onSpeechEnd={handleFooterSubmit}
                disabled={isStreaming}
                transparent
              />
              <Pressable
                disabled={!footerText.trim() || isStreaming}
                onPress={handleFooterSubmit}
                accessibilityRole="button"
                accessibilityLabel={tc('accessibility.send_message')}
                accessibilityState={{ disabled: !footerText.trim() || isStreaming }}
                style={{
                  backgroundColor:
                    !footerText.trim() || isStreaming
                      ? colors.mutedForeground + '22'
                      : colors.primary,
                  borderRadius: 22,
                  paddingHorizontal: 18,
                  minHeight: 44,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: !footerText.trim() || isStreaming ? colors.mutedForeground : '#FFF',
                  }}
                >
                  {tc('actions.send')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
