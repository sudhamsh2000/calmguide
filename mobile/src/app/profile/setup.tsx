import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemedInput } from '@/components/ThemedInput';
import { useTheme } from '@/components/ThemeContext';
import {
  createProfile,
  validateInviteCode,
  type CreateProfileData,
  type DiseaseStage,
} from '@/lib/api';
import { setAccessCode, setPatientName } from '@/lib/storage';
import { router, Stack } from 'expo-router';
import { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Step 1 is the invite-code gate (private testing — see backend
// INVITE_CODE_REQUIRED). Steps 2-6 are the original wizard, shifted down by
// one. Mirrors the web wizard's stepOffset pattern in ProfileWizard.tsx.
const TOTAL_STEPS = 6;

const BEHAVIORAL_PATTERNS = [
  'Sundowning',
  'Wandering/exit-seeking',
  'Aggression',
  'Repetitive questions',
  'Sleep disturbance',
  'Refusal to eat',
  'Hallucinations',
  'Hiding/hoarding objects',
  'Undressing inappropriately',
  'Shadowing/following caregiver',
];

const CALMING_STRATEGIES = [
  'Music (specify favorite)',
  'Family photos',
  'Warm drink',
  'Going for a walk',
  'Gentle hand massage',
  'Favorite TV show',
  'Pet interaction',
  'Rocking chair',
  'Aromatherapy',
];

const SAFETY_CONCERNS = [
  'Fall risk',
  'Wandering/elopement risk',
  'Stove/fire risk',
  'Medication confusion',
  'Aggressive when frustrated',
  'Cannot be left alone',
  'Driving risk',
  'Pool/water nearby',
];

const STAGE_KEYS: { value: DiseaseStage; color: string; bgColor: string }[] = [
  { value: 'early', color: '#2B7A78', bgColor: '#2B7A7818' },
  { value: 'middle', color: '#2B7A78', bgColor: '#2B7A7818' },
  { value: 'late', color: '#2B7A78', bgColor: '#2B7A7818' },
];

function MultiSelectChips({
  options,
  selected,
  onChange,
  color,
}: {
  options: string[];
  selected: string[];
  onChange: (updated: string[]) => void;
  color: string;
}) {
  const { colors } = useTheme();
  const { t: tCommon, i18n } = useTranslation('common');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const customItems = selected.filter((item) => !options.includes(item));

  function toggle(item: string) {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  }

  function handleAddCustom() {
    const trimmed = customValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomValue('');
    setShowCustomInput(false);
  }

  function handleShowInput() {
    setShowCustomInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {options.map((item) => {
          const isSelected = selected.includes(item);
          return (
            <Pressable
              key={item}
              onPress={() => toggle(item)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: isSelected ? color + '22' : colors.surface,
                borderWidth: 1.5,
                borderColor: isSelected ? color : colors.border,
                minHeight: 44,
                maxWidth: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isSelected ? '700' : '500',
                  color: isSelected ? color : colors.foreground,
                  textAlign: 'center',
                  flexShrink: 1,
                }}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
        {customItems.map((item) => (
          <Pressable
            key={item}
            onPress={() => toggle(item)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: color + '22',
              borderWidth: 1.5,
              borderColor: color,
              minHeight: 44,
              maxWidth: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: true }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: '700', color, textAlign: 'center', flexShrink: 1 }}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {showCustomInput ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextInput
            ref={inputRef}
            style={{
              flexBasis: '100%',
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 12,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.foreground,
              minHeight: 44,
              textAlign: I18nManager.isRTL ? 'right' : 'left',
              writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
            }}
            placeholder={tCommon('type_custom', { defaultValue: 'Type your own...' })}
            placeholderTextColor={colors.mutedForeground}
            value={customValue}
            onChangeText={setCustomValue}
            returnKeyType="done"
            onSubmitEditing={handleAddCustom}
            autoCorrect={false}
          />
          <Pressable
            onPress={handleAddCustom}
            disabled={!customValue.trim()}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: customValue.trim() ? color : colors.border,
              minHeight: 44,
              minWidth: 72,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
          >
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {tCommon('add', { defaultValue: 'Add' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowCustomInput(false);
              setCustomValue('');
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 10,
              minHeight: 44,
              minWidth: 72,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
          >
            <Text
              style={{ fontSize: 14, color: colors.mutedForeground }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {tCommon('cancel', { defaultValue: 'Cancel' })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleShowInput}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            alignSelf: 'flex-start',
            paddingVertical: 4,
          })}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 15, color, fontWeight: '500' }}>
            + {tCommon('add_custom', { defaultValue: 'Add custom option' })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ProfileSetupScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('profile');
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeError, setInviteCodeError] = useState('');
  const [checkingInviteCode, setCheckingInviteCode] = useState(false);
  const [patientNameValue, setPatientNameValue] = useState('');
  const [diseaseStage, setDiseaseStage] = useState<DiseaseStage | null>(null);
  const [behavioralPatterns, setBehavioralPatterns] = useState<string[]>([]);
  const [calmingStrategies, setCalmingStrategies] = useState<string[]>([]);
  const [safetyConcerns, setSafetyConcerns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState('');

  async function handleShareCode() {
    if (!successCode) return;
    try {
      await Share.share({
        message: `CalmGuide: ${successCode}`,
      });
    } catch {
      // Share sheet unavailable; selectable text remains available.
    }
  }

  function canProceed(): boolean {
    if (step === 1) return inviteCode.trim().length > 0;
    if (step === 2) return patientNameValue.trim().length > 0;
    if (step === 3) return diseaseStage !== null;
    if (step === 4) return behavioralPatterns.length > 0;
    if (step === 5) return calmingStrategies.length > 0;
    if (step === 6) return safetyConcerns.length > 0;
    return false;
  }

  async function nextStep() {
    if (!canProceed()) return;

    if (step === 1) {
      setCheckingInviteCode(true);
      setInviteCodeError('');
      try {
        const { valid } = await validateInviteCode(inviteCode.trim());
        if (!valid) {
          setInviteCodeError(t('errors.invalid_invite_code'));
          setCheckingInviteCode(false);
          return;
        }
      } catch {
        setInviteCodeError(t('errors.generic'));
        setCheckingInviteCode(false);
        return;
      }
      setCheckingInviteCode(false);
    }

    if (step < TOTAL_STEPS) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  async function handleCreate() {
    if (!diseaseStage) return;
    setLoading(true);
    setError('');
    try {
      const data: CreateProfileData = {
        disease_stage: diseaseStage,
        behavioral_patterns: behavioralPatterns,
        calming_strategies: calmingStrategies,
        safety_concerns: safetyConcerns,
        invite_code: inviteCode.trim(),
      };
      const result = await createProfile(data);
      await setAccessCode(result.access_code);
      await setPatientName(patientNameValue.trim());
      setSuccessCode(result.access_code);
    } catch {
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // Success screen
  if (successCode) {
    return (
      <>
        <Stack.Screen options={{ title: t('success.profile_created') }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{
            padding: 24,
            gap: 28,
            alignItems: 'center',
            paddingBottom: 60 + (Platform.OS === 'android' ? insets.bottom : 0),
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#00B894',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 20,
              boxShadow: '0 4px 16px rgba(0,184,148,0.35)',
            }}
          >
            {/* Classic border-trick checkmark */}
            <View
              style={{
                width: 14,
                height: 24,
                borderBottomWidth: 3.5,
                borderRightWidth: 3.5,
                borderColor: '#fff',
                marginTop: -6,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: colors.foreground,
                textAlign: 'center',
              }}
            >
              {t('success.profile_created')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.mutedForeground,
                textAlign: 'center',
                lineHeight: 24,
              }}
            >
              {t('success.save_code_message')}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.primary + '14',
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 24,
              alignItems: 'center',
              gap: 12,
              alignSelf: 'stretch',
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: colors.mutedForeground,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {t('success.access_code_label')}
            </Text>
            <Text
              selectable
              style={{ fontSize: 36, fontWeight: '900', color: colors.primary, letterSpacing: 6 }}
            >
              {successCode}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>
              {t('success.screenshot_hint')}
            </Text>
          </View>
          <Button
            variant="secondary"
            size="lg"
            onPress={handleShareCode}
            style={{ alignSelf: 'stretch' }}
          >
            {t('success.share_code', { defaultValue: 'Share Access Code' })}
          </Button>
          <Button
            size="lg"
            onPress={() => router.replace('/(tabs)/home')}
            style={{ alignSelf: 'stretch' }}
          >
            {t('success.start_button')}
          </Button>
        </ScrollView>
      </>
    );
  }

  const progressPercent = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <>
      <Stack.Screen
        options={{
          title:
            step === 1
              ? t('setup_title')
              : t('setup.step_of', {
                  step,
                  total: TOTAL_STEPS,
                  defaultValue: `Step ${step} of ${TOTAL_STEPS}`,
                }),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingBottom: 180 }}
          >
            <View style={{ gap: 24 }}>
              {/* Progress bar */}
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    height: 6,
                    backgroundColor: colors.border,
                    borderRadius: 3,
                    overflow: 'hidden',
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${progressPercent}%`,
                      backgroundColor: colors.primary,
                      borderRadius: 3,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                  {t('setup.step_of', {
                    step,
                    total: TOTAL_STEPS,
                    defaultValue: `Step ${step} of ${TOTAL_STEPS}`,
                  })}
                </Text>
              </View>

              {/* Step 1: Invite code (private-testing gate) */}
              {step === 1 && (
                <View style={{ gap: 16 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
                      {t('invite.heading')}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>
                      {t('invite.subtitle')}
                    </Text>
                  </View>
                  <ThemedInput
                    label={t('invite.code_label')}
                    placeholder={t('invite.code_placeholder')}
                    value={inviteCode}
                    onChangeText={(v) => setInviteCode(v.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={nextStep}
                    error={inviteCodeError || undefined}
                  />
                  <Card variant="default" padding={14}>
                    <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20 }}>
                      {t('invite.hint')}
                    </Text>
                  </Card>
                </View>
              )}

              {/* Step 2: Patient name */}
              {step === 2 && (
                <View style={{ gap: 16 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
                      {t('setup.heading')}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>
                      {t('setup.subtitle')}
                    </Text>
                  </View>
                  <ThemedInput
                    label={t('setup.name_label')}
                    placeholder={t('setup.name_placeholder')}
                    value={patientNameValue}
                    onChangeText={setPatientNameValue}
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={nextStep}
                  />
                  <Card variant="default" padding={14}>
                    <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20 }}>
                      {t('setup.name_privacy')}
                    </Text>
                  </Card>
                </View>
              )}

              {/* Step 3: Disease stage */}
              {step === 3 && (
                <View style={{ gap: 16 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
                      {t('setup.stage_heading')}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>
                      {t('setup.stage_subtitle')}
                    </Text>
                  </View>
                  <View style={{ gap: 12 }}>
                    {STAGE_KEYS.map(({ value, color, bgColor }) => {
                      const isSelected = diseaseStage === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => setDiseaseStage(value)}
                          style={{
                            backgroundColor: isSelected ? bgColor : colors.surface,
                            borderRadius: 16,
                            borderCurve: 'continuous',
                            padding: 16,
                            borderWidth: 2,
                            borderColor: isSelected ? color : colors.border,
                            gap: 6,
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 17,
                                fontWeight: '700',
                                color: isSelected ? color : colors.foreground,
                              }}
                            >
                              {t(`disease_stage.${value}_title`)}
                            </Text>
                            {isSelected && (
                              <View
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 5,
                                  backgroundColor: color,
                                }}
                              />
                            )}
                          </View>
                          <Text
                            style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20 }}
                          >
                            {t(`disease_stage.${value}_description`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Step 4: Behavioral patterns */}
              {step === 4 && (
                <View style={{ gap: 16 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
                      {t('steps.behavioral.title')}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>
                      {t('steps.behavioral.description')}
                    </Text>
                  </View>
                  <MultiSelectChips
                    options={BEHAVIORAL_PATTERNS}
                    selected={behavioralPatterns}
                    onChange={setBehavioralPatterns}
                    color={colors.primary}
                  />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                    {behavioralPatterns.length} selected
                  </Text>
                </View>
              )}

              {/* Step 5: Calming strategies */}
              {step === 5 && (
                <View style={{ gap: 16 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
                      {t('steps.calming.title')}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>
                      {t('steps.calming.description')}
                    </Text>
                  </View>
                  <MultiSelectChips
                    options={CALMING_STRATEGIES}
                    selected={calmingStrategies}
                    onChange={setCalmingStrategies}
                    color={colors.primary}
                  />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                    {calmingStrategies.length} selected
                  </Text>
                </View>
              )}

              {/* Step 6: Safety concerns */}
              {step === 6 && (
                <View style={{ gap: 16 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
                      {t('steps.safety.title')}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>
                      {t('steps.safety.description')}
                    </Text>
                  </View>
                  <MultiSelectChips
                    options={SAFETY_CONCERNS}
                    selected={safetyConcerns}
                    onChange={setSafetyConcerns}
                    color={colors.primary}
                  />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                    {safetyConcerns.length} selected
                  </Text>
                  {error ? (
                    <View
                      style={{
                        backgroundColor: colors.error + '18',
                        borderRadius: 10,
                        padding: 14,
                        borderStartWidth: 3,
                        borderStartColor: colors.error,
                      }}
                    >
                      <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </ScrollView>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background + 'F2',
              paddingHorizontal: 24,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom, 12),
              flexDirection: 'row',
              gap: 12,
            }}
          >
            {step > 1 ? (
              <View style={{ flex: 1 }}>
                <Button variant="secondary" size="lg" onPress={prevStep}>
                  {t('actions.back')}
                </Button>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              {step < TOTAL_STEPS ? (
                <Button variant="primary" size="lg" disabled={!canProceed()} onPress={nextStep}>
                  {t('actions.next')}
                </Button>
              ) : (
                <Button variant="primary" size="lg" loading={loading} onPress={handleCreate}>
                  {t('actions.create')}
                </Button>
              )}
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}
