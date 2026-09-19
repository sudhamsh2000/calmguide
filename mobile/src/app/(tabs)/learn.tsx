import { CategoryBadge } from '@/components/CategoryBadge';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { useTheme } from '@/components/ThemeContext';
import { getScenarios, type Scenario, type ScenarioCategory } from '@/lib/api';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type FilterCategory = 'all' | ScenarioCategory;

const FALLBACK_SCENARIOS: Scenario[] = [
  {
    id: '1',
    title: 'Sundowning Agitation',
    description:
      'Your loved one becomes increasingly agitated and confused as evening approaches. Practice de-escalation techniques.',
    category: 'behavioral',
  },
  {
    id: '2',
    title: 'Refusing Medication',
    description:
      'Your loved one refuses to take their daily medication. Practice gentle persuasion strategies.',
    category: 'daily_care',
  },
  {
    id: '3',
    title: 'Wandering at Night',
    description:
      'You wake up to find your loved one has left their room. Practice immediate safety response.',
    category: 'safety',
  },
  {
    id: '4',
    title: 'Repetitive Questions',
    description:
      'Your loved one asks the same question every few minutes. Practice compassionate response techniques.',
    category: 'communication',
  },
  {
    id: '5',
    title: 'Caregiver Burnout',
    description:
      'You are feeling overwhelmed and exhausted. Practice self-care planning and boundary setting.',
    category: 'self_care',
  },
  {
    id: '6',
    title: 'Aggressive Behavior',
    description:
      'Your loved one becomes physically aggressive during bathing. Practice de-escalation and safety techniques.',
    category: 'behavioral',
  },
];

export default function LearnScreen() {
  return (
    <MedicalDisclaimer>
      <LearnScreenInner />
    </MedicalDisclaimer>
  );
}

function LearnScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('learn');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [scenarios, setScenarios] = useState<Scenario[]>(FALLBACK_SCENARIOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getScenarios()
      .then((data) => {
        if (data.length > 0) setScenarios(data);
      })
      .catch(() => setError(t('list.load_error', 'Unable to load scenarios. Showing examples.')))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeCategory === 'all' ? scenarios : scenarios.filter((s) => s.category === activeCategory);

  const CATEGORIES: { key: FilterCategory; label: string }[] = [
    { key: 'all', label: t('list.filter_all', 'All') },
    { key: 'behavioral', label: t('list.filter_behavioral', 'Behavioral') },
    { key: 'daily_care', label: t('list.filter_daily_care', 'Daily Care') },
    { key: 'safety', label: t('list.filter_safety', 'Safety') },
    { key: 'communication', label: t('list.filter_communication', 'Communication') },
    { key: 'self_care', label: t('list.filter_self_care', 'Self Care') },
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('title', 'Practice Scenarios'), headerLargeTitle: true }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingBottom: 40,
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
        }}
      >
        {/* Header description */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            {t('list.subtitle', 'Practice common situations to feel more prepared.')}
          </Text>
        </View>

        {/* Category filter chips */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 8,
          }}
        >
          {CATEGORIES.map(({ key, label }) => {
            const isActive = activeCategory === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveCategory(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: isActive ? colors.primary : colors.border,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: isActive ? colors.onPrimary : colors.foreground,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {error ? (
              <View
                style={{
                  backgroundColor: colors.error + '14',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.error }}>{error}</Text>
              </View>
            ) : null}

            {filtered.length === 0 ? (
              <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  {t('list.empty', 'No scenarios in this category.')}
                </Text>
                <Pressable onPress={() => setActiveCategory('all')}>
                  <Text style={{ color: colors.primary, fontWeight: '500' }}>
                    {t('list.show_all', 'Show all scenarios')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              filtered.map((scenario) => {
                const stage =
                  'disease_stage' in scenario
                    ? (scenario.disease_stage as string | undefined)
                    : undefined;
                const stageLabel = stage
                  ? t(`scenario.stage_label`, {
                      stage: t(`scenario.stages.${stage}`, stage),
                      defaultValue: `${stage} stage`,
                    })
                  : null;
                return (
                  <Pressable
                    key={scenario.id}
                    onPress={() => router.push(`/learn/${scenario.id}`)}
                    style={({ pressed }) => ({
                      gap: 8,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: pressed ? colors.primary + '55' : colors.border,
                      backgroundColor: colors.surface,
                      padding: 16,
                      opacity: pressed ? 0.9 : 1,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={t(`scenarios.${scenario.id}.title`, scenario.title)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <CategoryBadge category={scenario.category} />
                      {stageLabel ? (
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 20,
                            backgroundColor: colors.foreground + '0C',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '500',
                              color: colors.mutedForeground,
                              textTransform: 'capitalize',
                            }}
                          >
                            {stageLabel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '600',
                        color: colors.foreground,
                        lineHeight: 23,
                      }}
                    >
                      {t(`scenarios.${scenario.id}.title`, scenario.title)}
                    </Text>
                    <Text
                      style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20 }}
                      numberOfLines={2}
                    >
                      {t(`scenarios.${scenario.id}.description`, scenario.description)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
