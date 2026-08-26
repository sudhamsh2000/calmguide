import { Card } from '@/components/Card';
import { PatientCard } from '@/components/PatientCard';
import { PatternInsights } from '@/components/PatternInsights';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeContext';
import { getConversations, getInsights, getProfile, getPendingFeedback, submitFeedback, skipFeedback, getDailyCheckinStatus, submitDailyCheckin, getCarePatterns, getIncidents, getPatterns, getVerificationPending, type ConversationSummary, type InsightsPayload, type ProfileResponse, type PendingFeedback, type CarePatternData, type IncidentResponse, type PatternResponse, type VerificationPending } from '@/lib/api';
import { VerificationCard } from '@/components/VerificationCard';
import { HomeFeedbackCard } from '@/components/HomeFeedbackCard';
import { DailyCheckinCard } from '@/components/DailyCheckinCard';
import { CarePatternCard } from '@/components/CarePatternCard';
import { IncidentPatternCard } from '@/components/IncidentPatternCard';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { getAccessCode, getPatientName, getProfiles } from '@/lib/storage';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

function formatTimestamp(
  iso: string,
  locale: string,
  t: (key: string, opts?: Record<string, string | number>) => string,
): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const timeStr = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) {
    return t('conversations.timestamp_today_at', { time: timeStr });
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return t('conversations.timestamp_yesterday_at', { time: timeStr });
  }
  if (diffDays < 7) {
    return t('conversations.timestamp_weekday_at', {
      weekday: date.toLocaleDateString(locale, { weekday: 'long' }),
      time: timeStr,
    });
  }
  return t('conversations.timestamp_date_at', {
    date: date.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    time: timeStr,
  });
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [patientName, setPatientNameState] = useState('');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [carePattern, setCarePattern] = useState<CarePatternData | null>(null);
  const [verificationPending, setVerificationPending] = useState<VerificationPending | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<IncidentResponse[]>([]);
  const [incidentPatterns, setIncidentPatterns] = useState<PatternResponse | null>(null);
  const [hasMultipleProfiles, setHasMultipleProfiles] = useState(false);
  const [accessCode, setAccessCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12
    ? t('greeting.morning')
    : hour >= 12 && hour < 17
      ? t('greeting.afternoon')
      : t('greeting.evening');

  const load = useCallback(async () => {
    const code = await getAccessCode();
    const name = await getPatientName();
    if (!code) { router.replace('/'); return; }
    setAccessCode(code);
    setPatientNameState(name ?? 'Your Patient');
    try {
      const [p, c] = await Promise.all([getProfile(code), getConversations(code)]);
      setProfile(p);
      setConversations(c.slice(0, 5));
      getInsights(code).then((data) => { if (data) setInsights(data.insights); }).catch(() => {});
      getPendingFeedback(code).then((data) => { if (data) setPendingFeedback(data); }).catch(() => {});
      getDailyCheckinStatus(code).then((data) => { setCheckedInToday(data.checked_in); }).catch(() => {});
      getCarePatterns(code).then((data) => { setCarePattern(data); }).catch(() => {});
      getVerificationPending(code).then((data) => { if (data) setVerificationPending(data); }).catch(() => {});
      getIncidents(code, { limit: 3 }).then((data) => setRecentIncidents(data.incidents)).catch(() => {});
      getPatterns(code).then((data) => { if (data) setIncidentPatterns(data); }).catch(() => {});
      getProfiles().then((p) => setHasMultipleProfiles(p.length > 1)).catch(() => {});
    } catch {
      setLoadError(t('server_error'));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const handleFeedbackSubmit = useCallback(
    async (helpful: boolean, tags: string[], negativeReasons: string[]) => {
      const code = await getAccessCode();
      if (!code || !pendingFeedback) return;
      try {
        await submitFeedback(code, pendingFeedback.conversation_id, helpful, tags, negativeReasons);
        // Show thanks, then auto-dismiss after 4 seconds
        setTimeout(() => setPendingFeedback(null), 4000);
      } catch { /* silent */ }
    },
    [pendingFeedback],
  );

  const handleCheckin = useCallback(
    async (
      severity: 'calm' | 'mild' | 'tough',
      timeSlot?: string,
      tags?: string[],
    ) => {
      const code = await getAccessCode();
      if (!code) return;
      await submitDailyCheckin(code, severity, timeSlot, tags);
      setCheckedInToday(true);
    },
    [],
  );

  const handleFeedbackDismiss = useCallback(async () => {
    const code = await getAccessCode();
    if (!code || !pendingFeedback) return;
    setFeedbackDismissed(true);
    try { await skipFeedback(code, pendingFeedback.conversation_id); } catch { /* silent */ }
  }, [pendingFeedback]);

  return (
    <>
      <Stack.Screen options={{ title: tc('app_name'), headerLargeTitle: true }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40, paddingTop: Platform.OS === 'android' ? insets.top + 20 : 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Profile Switcher */}
        {hasMultipleProfiles && (
          <ProfileSwitcher onSwitch={() => { setLoading(true); load(); }} />
        )}

        {/* Greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ fontSize: 15, color: colors.mutedForeground }}>{greeting}</Text>
          <Text style={{ fontSize: 26, fontWeight: '500', color: colors.foreground, lineHeight: 32 }}>
            {t('hero')}
          </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* 2. Urgent alerts — care pattern warnings */}
        {carePattern?.care_level === 'needs_attention' ? (
          <CarePatternCard carePattern={carePattern} />
        ) : null}

        {/* Companion button — gradient card (first action after greeting) */}
        <Pressable
          onPress={() => router.push('/coach')}
          style={({ pressed }) => ({
            borderRadius: 18,
            overflow: 'hidden',
            opacity: pressed ? 0.92 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel={tc('nav.coach')}
        >
          <View
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 28,
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* Subtle radial highlight overlay */}
            <View
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
            />
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                <Line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <Line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: '500', color: '#FFFFFF', textAlign: 'center', lineHeight: 26 }}>
                {t('coach_card.title')}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
                {t('coach_card.subtitle')}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* 3. Patient card */}
        {loadError ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={{
              backgroundColor: colors.error + '14',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.error + '33',
            }}
          >
            <Text style={{ color: colors.error, fontSize: 14, lineHeight: 20 }}>{loadError}</Text>
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : profile ? (
          <PatientCard
            patientName={patientName}
            diseaseStage={profile.disease_stage}
            behavioralPatternsCount={profile.behavioral_patterns.length}
            onEditPress={() => router.push('/(tabs)/profile')}
          />
        ) : (
          <Card variant="default">
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 14 }}>
              No profile loaded. Tap Profile to set one up.
            </Text>
          </Card>
        )}

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Practice */}
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 10,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 20,
              opacity: pressed ? 0.75 : 1,
            })}
            onPress={() => router.push('/(tabs)/learn')}
            accessibilityRole="button"
            accessibilityLabel={t('quick_actions.practice')}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EDE4F7', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke="#7C4DBA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="#7C4DBA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ alignItems: 'center', gap: 2, width: '100%' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, textAlign: 'center' }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
                {t('quick_actions.practice')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }} numberOfLines={3}>
                {t('quick_actions.practice_subtitle')}
              </Text>
            </View>
          </Pressable>

          {/* Check-In */}
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 10,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 20,
              opacity: pressed ? 0.75 : 1,
            })}
            onPress={() => router.push('/check-in')}
            accessibilityRole="button"
            accessibilityLabel={t('quick_actions.check_in')}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#E0F0E7', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#3A7D5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ alignItems: 'center', gap: 2, width: '100%' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, textAlign: 'center' }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
                {t('quick_actions.check_in')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }} numberOfLines={3}>
                {t('quick_actions.check_in_subtitle')}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 5. Verification card — non-urgent alert */}
        {verificationPending && accessCode ? (
          <VerificationCard
            accessCode={accessCode}
            pending={verificationPending}
            onDismiss={() => setVerificationPending(null)}
          />
        ) : null}

        {/* 7. Daily check-in — routine action */}
        {!checkedInToday ? (
          <DailyCheckinCard onCheckin={handleCheckin} />
        ) : null}

        {/* 8. Feedback card */}
        {pendingFeedback && !feedbackDismissed ? (
          <HomeFeedbackCard
            pending={pendingFeedback}
            onDismiss={handleFeedbackDismiss}
            onSubmit={handleFeedbackSubmit}
          />
        ) : null}

        {/* 9. Pattern insights — behavioral trends */}
        {insights ? <PatternInsights insights={insights} /> : null}
        {incidentPatterns && <IncidentPatternCard patterns={incidentPatterns} />}

        {/* Log an Incident */}
        <Pressable
          onPress={() => router.push('/incidents/new' as import('expo-router').Href)}
          accessibilityRole="button"
          accessibilityLabel={t('log_incident')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF3CD', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, color: '#856404' }}>+</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
            {t('log_incident', { defaultValue: 'Log an incident' })}
          </Text>
        </Pressable>

        {/* Recent Incidents */}
        {recentIncidents.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {t('recent_incidents')}
              </Text>
              <Pressable
                onPress={() => router.push('/incidents' as import('expo-router').Href)}
                accessibilityRole="link"
                accessibilityLabel={t('see_all')}
              >
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>{t('see_all')}</Text>
              </Pressable>
            </View>
            {recentIncidents.map((inc) => (
              <Pressable
                key={inc.id}
                onPress={() => router.push(`/incidents/${inc.id}` as import('expo-router').Href)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  minHeight: 44,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                  {new Date(inc.incident_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }} numberOfLines={1}>
                  {inc.behavior_description}
                </Text>
                {inc.severity && (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'capitalize' }}>{inc.severity}</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Conversation history */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            {t('conversations.title')}
          </Text>
          {!loading && conversations.length === 0 ? (
            <Card variant="default" padding={14}>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20 }}>
                {t('conversations.empty')}
              </Text>
            </Card>
          ) : (
            conversations.map((conv) => (
              <Pressable
                key={conv.session_id}
                style={({ pressed }) => ({
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: pressed ? colors.primary + '44' : colors.border,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 4,
                })}
                onPress={() => router.push(`/coach?session_id=${conv.session_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation: ${conv.title}`}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }} numberOfLines={1}>
                  {conv.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {formatTimestamp(conv.created_at, i18n.language, t)}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* 11. Journey navigation — bottom of page */}
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
            {tc('journey_nav.heading')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { labelKey: 'journey_nav.noticing', href: '/journey/noticing' },
              { labelKey: 'journey_nav.diagnosis', href: '/journey/diagnosis' },
              { labelKey: 'journey_nav.hospice', href: '/journey/hospice' },
              { labelKey: 'journey_nav.bereavement', href: '/journey/bereavement' },
            ].map((item) => (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as never)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: pressed ? colors.primary + '66' : colors.border,
                  backgroundColor: pressed ? colors.primary + '08' : colors.surface,
                  borderRadius: 18,
                  paddingHorizontal: 12,
                  minHeight: 44,
                  justifyContent: 'center',
                  flexBasis: '48%',
                  flexGrow: 1,
                })}
                accessibilityRole="link"
                accessibilityLabel={tc(item.labelKey)}
              >
                <Text style={{ fontSize: 14, color: colors.foreground }}>{tc(item.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Impact link */}
        <Pressable onPress={() => router.push('/impact')} style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, textDecorationLine: 'underline' }}>
            {t('impact_link')}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
