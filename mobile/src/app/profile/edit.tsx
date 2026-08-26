import { Button } from '@/components/Button';
import { useTheme } from '@/components/ThemeContext';
import { getProfile, updateProfile, type DiseaseStage } from '@/lib/api';
import { getAccessCode } from '@/lib/storage';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const STAGE_OPTIONS: { value: DiseaseStage; label: string; color: string; bgColor: string }[] = [
  { value: 'early', label: 'Early Stage', color: '#2B7A78', bgColor: '#2B7A7818' },
  { value: 'middle', label: 'Middle Stage', color: '#2B7A78', bgColor: '#2B7A7818' },
  { value: 'late', label: 'Late Stage', color: '#2B7A78', bgColor: '#2B7A7818' },
];

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 4 }}>
      {title}
    </Text>
  );
}

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

  function toggle(item: string) {
    onChange(
      selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]
    );
  }

  return (
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
              }}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('profile');
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [diseaseStage, setDiseaseStage] = useState<DiseaseStage>('early');
  const [behavioralPatterns, setBehavioralPatterns] = useState<string[]>([]);
  const [calmingStrategies, setCalmingStrategies] = useState<string[]>([]);
  const [safetyConcerns, setSafetyConcerns] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const code = await getAccessCode();
      if (!code) { router.replace('/'); return; }
      try {
        const profile = await getProfile(code);
        setDiseaseStage(profile.disease_stage);
        setBehavioralPatterns(profile.behavioral_patterns);
        setCalmingStrategies(profile.calming_strategies);
        setSafetyConcerns(profile.safety_concerns);
      } catch {
        setError('Could not load profile.');
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    const code = await getAccessCode();
    if (!code) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile(code, {
        disease_stage: diseaseStage,
        behavioral_patterns: behavioralPatterns,
        calming_strategies: calmingStrategies,
        safety_concerns: safetyConcerns,
      });
      router.back();
    } catch {
      setError('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Edit Profile' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 28, paddingBottom: 60 + (Platform.OS === 'android' ? insets.bottom : 0) }}
        >
          {/* Disease stage */}
          <View style={{ gap: 14 }}>
            <SectionTitle title={t('disease_stage.label')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {STAGE_OPTIONS.map(({ value, label, color, bgColor }) => {
                const isSelected = diseaseStage === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDiseaseStage(value)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      paddingHorizontal: 8,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: isSelected ? bgColor : colors.surface,
                      borderWidth: 2,
                      borderColor: isSelected ? color : colors.border,
                      alignItems: 'center',
                      gap: 4,
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? color : colors.foreground, textAlign: 'center' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Behavioral patterns */}
          <View style={{ gap: 14 }}>
            <SectionTitle title={t('behavioral_patterns.label')} />
            <MultiSelectChips
              options={BEHAVIORAL_PATTERNS}
              selected={behavioralPatterns}
              onChange={setBehavioralPatterns}
              color={colors.primary}
            />
          </View>

          {/* Calming strategies */}
          <View style={{ gap: 14 }}>
            <SectionTitle title={t('calming_strategies.label')} />
            <MultiSelectChips
              options={CALMING_STRATEGIES}
              selected={calmingStrategies}
              onChange={setCalmingStrategies}
              color={colors.primary}
            />
          </View>

          {/* Safety concerns */}
          <View style={{ gap: 14 }}>
            <SectionTitle title={t('safety_concerns.label')} />
            <MultiSelectChips
              options={SAFETY_CONCERNS}
              selected={safetyConcerns}
              onChange={setSafetyConcerns}
              color={colors.primary}
            />
          </View>

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

          <Button size="lg" loading={saving} onPress={handleSave}>
            {t('actions.save_changes')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
