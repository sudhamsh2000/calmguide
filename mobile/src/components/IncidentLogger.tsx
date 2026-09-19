import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import { Button } from './Button';
import { getAccessCode } from '../lib/storage';
import { createIncident, updateIncident } from '../lib/api';
import { createIncidentByProfile } from '../lib/facility-api';
import type {
  BehaviorCategory,
  SeverityLevel,
  DurationCategory,
  AntecedentCategory,
  InterventionOutcome,
  IncidentCreate,
} from '../lib/api';

interface IncidentLoggerProps {
  onComplete?: () => void;
  profileId?: string;
}

const BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  'aggression_anger',
  'confusion_disorientation',
  'wandering_exit_seeking',
  'refusing_care',
  'sleep_problems',
  'hallucinations',
  'repetitive_behavior',
  'other',
];

const CATEGORY_LABELS: Record<BehaviorCategory, string> = {
  aggression_anger: 'A',
  confusion_disorientation: '?',
  wandering_exit_seeking: 'W',
  refusing_care: 'X',
  sleep_problems: 'Z',
  hallucinations: 'E',
  repetitive_behavior: 'R',
  other: '...',
};

const CATEGORY_COLORS: Record<BehaviorCategory, string> = {
  aggression_anger: '#DC4E4E',
  confusion_disorientation: '#D4893A',
  wandering_exit_seeking: '#3E8FD0',
  refusing_care: '#8B5E3C',
  sleep_problems: '#5B6ABF',
  hallucinations: '#7B5EA7',
  repetitive_behavior: '#4A90A4',
  other: '#6B7280',
};

const SEVERITY_LEVELS: SeverityLevel[] = ['mild', 'moderate', 'severe'];
const DURATION_CATEGORIES: DurationCategory[] = ['seconds', 'minutes', 'about_an_hour', 'longer'];

const ANTECEDENT_CATEGORIES: AntecedentCategory[] = [
  'task_demand',
  'transition',
  'environmental',
  'social',
  'physical_state',
  'unknown',
];

const INTERVENTION_OPTIONS = [
  'music',
  'redirect',
  'quiet_space',
  'warm_drink',
  'wait_it_out',
  'other',
] as const;
const OUTCOME_OPTIONS: InterventionOutcome[] = [
  'resolved',
  'partially_resolved',
  'unresolved',
  'escalated',
];

type TimeChoice = 'just_now' | 'earlier_today' | 'yesterday';

function resolveIncidentTime(choice: TimeChoice): string {
  const now = new Date();
  if (choice === 'just_now') return now.toISOString();
  if (choice === 'earlier_today') {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

const INTERVENTION_TO_DESCRIPTION: Record<string, string> = {
  music: 'Played music',
  redirect: 'Redirected attention',
  quiet_space: 'Moved to quiet space',
  warm_drink: 'Offered warm drink',
  wait_it_out: 'Waited it out',
  other: 'Other intervention',
};

export function IncidentLogger({ onComplete, profileId }: IncidentLoggerProps) {
  const { t } = useTranslation('incidents');
  const { colors } = useTheme();
  const router = useRouter();

  const [level, setLevel] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showMorePrompt, setShowMorePrompt] = useState(false);

  const [category, setCategory] = useState<BehaviorCategory | null>(null);
  const [timeChoice, setTimeChoice] = useState<TimeChoice | null>(null);
  const [severity, setSeverity] = useState<SeverityLevel | null>(null);
  const [duration, setDuration] = useState<DurationCategory | null>(null);
  const [antecedent, setAntecedent] = useState<AntecedentCategory | null>(null);
  const [intervention, setIntervention] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<InterventionOutcome | null>(null);
  const [notes, setNotes] = useState('');
  const [accessCode, setAccessCode] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) {
      getAccessCode().then(setAccessCode);
    }
  }, [profileId]);

  const buildIncidentData = useCallback((): IncidentCreate | null => {
    if (!category || !timeChoice) return null;
    return {
      behavior_category: category,
      behavior_description: t(`logger.category.${category}`).replace(/\n/g, ' '),
      incident_time: resolveIncidentTime(timeChoice),
      source: 'manual',
      severity: severity ?? undefined,
      duration_category: duration ?? undefined,
      antecedent_category: antecedent ?? undefined,
      antecedent_description: antecedent ? t(`logger.antecedent.${antecedent}`) : undefined,
      intervention_description: intervention
        ? (INTERVENTION_TO_DESCRIPTION[intervention] ?? intervention)
        : undefined,
      intervention_outcome: outcome ?? undefined,
    };
  }, [category, timeChoice, severity, duration, antecedent, intervention, outcome, t]);

  const savingRef = useRef(false);
  const savedIdRef = useRef<string | null>(null);

  const saveIncident = useCallback(async () => {
    if ((!accessCode && !profileId) || savingRef.current) return;
    const data = buildIncidentData();
    if (!data) return;
    if (notes.trim()) {
      data.behavior_description = `${data.behavior_description}. ${notes.trim()}`;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (savedIdRef.current) {
        if (!profileId) {
          await updateIncident(accessCode!, savedIdRef.current, data);
        }
      } else {
        let result;
        if (profileId) {
          result = await createIncidentByProfile(profileId, data);
        } else {
          result = await createIncident(accessCode!, data);
        }
        savedIdRef.current = result.id;
        setSavedId(result.id);
      }
    } catch (err) {
      if (__DEV__) console.warn('Incident save failed:', err);
      Alert.alert(
        'Could not save',
        'Your entry is still here. Check your connection and try the next step again.',
        [{ text: 'OK' }],
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [accessCode, profileId, buildIncidentData, notes]);

  const saveIncidentRef = useRef(saveIncident);
  saveIncidentRef.current = saveIncident;

  useEffect(() => {
    if (category && timeChoice && !savedId && !savingRef.current) {
      saveIncidentRef.current();
    }
  }, [category, timeChoice, savedId]);

  useEffect(() => {
    if (!savedId) return;
    if (!severity && !duration && !antecedent && !intervention && !outcome) return;
    const timer = setTimeout(() => {
      if (!savingRef.current) saveIncidentRef.current();
    }, 500);
    return () => clearTimeout(timer);
  }, [savedId, severity, duration, antecedent, intervention, outcome]);

  const haptic = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const goHome = () => {
    if (onComplete) onComplete();
    else router.back();
  };

  const chipStyle = (selected: boolean): ViewStyle => ({
    borderWidth: 2,
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? colors.primary : colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  });

  const chipText = (selected: boolean) => ({
    color: selected ? '#FFFFFF' : colors.foreground,
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  });

  if (savedId && showMorePrompt && level === 1) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        <View style={{ alignItems: 'center', gap: 12, marginTop: 20 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.success + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28, color: colors.success }}>{'✓'}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '600', color: colors.foreground }}>
            {t('logger.saved')}
          </Text>
          <Text style={{ fontSize: 16, color: colors.mutedForeground, textAlign: 'center' }}>
            {t('logger.more_details_prompt')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              size="lg"
              onPress={() => {
                setShowMorePrompt(false);
                setLevel(2);
              }}
            >
              {t('logger.yes_add_details')}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" size="lg" onPress={goHome}>
              {t('logger.no_thanks')}
            </Button>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (level === 1) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600', color: colors.foreground }}>
          {t('logger.title')}
        </Text>
        {!category && (
          <>
            <Text style={{ fontSize: 18, color: colors.foreground }}>
              {t('logger.what_happened')}
            </Text>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}
            >
              {BEHAVIOR_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => {
                    haptic();
                    setCategory(cat);
                  }}
                  style={({ pressed }) => ({
                    width: '46%',
                    borderWidth: 2,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.primary + '08' : colors.surface,
                    borderRadius: 16,
                    paddingVertical: 20,
                    paddingHorizontal: 12,
                    minHeight: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category === cat }}
                  accessibilityLabel={t(`logger.category.${cat}`).replace(/\n/g, ' ')}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: CATEGORY_COLORS[cat] + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: CATEGORY_COLORS[cat],
                      }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: colors.foreground,
                      textAlign: 'center',
                      lineHeight: 18,
                    }}
                  >
                    {t(`logger.category.${cat}`).replace(/\n/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {category && !timeChoice && (
          <>
            <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.when')}</Text>
            {(['just_now', 'earlier_today', 'yesterday'] as TimeChoice[]).map((tc) => (
              <Pressable
                key={tc}
                onPress={() => {
                  haptic();
                  setTimeChoice(tc);
                  setShowMorePrompt(true);
                }}
                style={{
                  borderWidth: 2,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  minHeight: 48,
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: timeChoice === tc }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                  {t(`logger.${tc}`)}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  if (level === 2) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600', color: colors.foreground }}>
          {t('logger.title')}
        </Text>
        <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.how_bad')}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {SEVERITY_LEVELS.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                haptic();
                setSeverity(s);
              }}
              style={[chipStyle(severity === s), { flex: 1 }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: severity === s }}
            >
              <Text style={chipText(severity === s)}>{t(`logger.severity.${s}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.how_long')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {DURATION_CATEGORIES.map((d) => (
            <Pressable
              key={d}
              onPress={() => {
                haptic();
                setDuration(d);
              }}
              style={[chipStyle(duration === d), { width: '47%' }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: duration === d }}
            >
              <Text style={chipText(duration === d)}>{t(`logger.duration.${d}`)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="primary" size="lg" onPress={() => setLevel(3)}>
              {t('logger.save')}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" size="lg" onPress={() => setLevel(3)}>
              {t('logger.skip')}
            </Button>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (level === 3) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600', color: colors.foreground }}>
          {t('logger.title')}
        </Text>
        <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.what_before')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {ANTECEDENT_CATEGORIES.map((a) => (
            <Pressable
              key={a}
              onPress={() => {
                haptic();
                setAntecedent(a);
              }}
              style={[chipStyle(antecedent === a), { width: '47%' }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: antecedent === a }}
            >
              <Text style={chipText(antecedent === a)}>{t(`logger.antecedent.${a}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.what_tried')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {INTERVENTION_OPTIONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => {
                haptic();
                setIntervention(i);
              }}
              style={[chipStyle(intervention === i), { width: '30%' }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: intervention === i }}
            >
              <Text style={chipText(intervention === i)}>{t(`logger.intervention.${i}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.did_it_help')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {OUTCOME_OPTIONS.map((o) => (
            <Pressable
              key={o}
              onPress={() => {
                haptic();
                setOutcome(o);
              }}
              style={[chipStyle(outcome === o), { width: '47%' }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: outcome === o }}
            >
              <Text style={chipText(outcome === o)}>{t(`logger.outcome.${o}`)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="primary" size="lg" onPress={() => setLevel(4)}>
              {t('logger.save')}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" size="lg" onPress={() => setLevel(4)}>
              {t('logger.skip')}
            </Button>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600', color: colors.foreground }}>
          {t('logger.title')}
        </Text>
        <Text style={{ fontSize: 18, color: colors.foreground }}>{t('logger.anything_else')}</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          style={{
            borderWidth: 2,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: colors.foreground,
            minHeight: 120,
            textAlignVertical: 'top',
          }}
        />
        <Button
          variant="primary"
          size="lg"
          loading={saving}
          onPress={async () => {
            await saveIncident();
            goHome();
          }}
        >
          {t('logger.done')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
