import { Button } from '@/components/Button';
import { CategoryBadge } from '@/components/CategoryBadge';
import { MarkdownText } from '@/components/MarkdownText';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { MicButton } from '@/components/MicButton';
import { useTheme } from '@/components/ThemeContext';
import { ThemedInput } from '@/components/ThemedInput';
import { getScenario, interactWithScenario, type DiseaseStage } from '@/lib/api';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type Phase = 'scenario' | 'loading' | 'response';

interface FeedbackSection {
  heading: string;
  content: string;
}

function parseFeedback(raw: string): FeedbackSection[] {
  const sections: FeedbackSection[] = [];
  const lines = raw.split('\n');
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(?:\d+\.\s*)?(.+)/);
    if (headingMatch) {
      if (currentHeading && currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = headingMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentHeading && currentContent.length > 0) {
    sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }
  return sections;
}

interface ScenarioData {
  id: string;
  title: string;
  description: string;
  category: string;
  disease_stage: DiseaseStage;
}

export default function ScenarioScreen() {
  return (
    <MedicalDisclaimer>
      <ScenarioScreenInner />
    </MedicalDisclaimer>
  );
}

function ScenarioScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('learn');
  const { t: tc } = useTranslation('common');
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [phase, setPhase] = useState<Phase>('scenario');
  const [userResponse, setUserResponse] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getScenario(id)
      .then((s) => setScenario(s as ScenarioData))
      .catch(() => setError(t('error.load_failed')))
      .finally(() => setLoadingScenario(false));
  }, [id, t]);

  async function handlePractice() {
    if (!userResponse.trim() || !scenario) return;
    setPhase('loading');
    setError('');
    try {
      const result = await interactWithScenario({
        scenario_id: scenario.id,
        disease_stage: scenario.disease_stage,
        message: userResponse.trim(),
      });
      setAiResponse(result.response);
      setPhase('response');
    } catch {
      setError(t('error.feedback_failed'));
      setPhase('scenario');
    }
  }

  function handleTryAgain() {
    setPhase('scenario');
    setUserResponse('');
    setAiResponse('');
    setError('');
  }

  if (loadingScenario) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!scenario) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ color: colors.error, fontSize: 16, textAlign: 'center' }}>
          {error || t('error.not_found')}
        </Text>
      </View>
    );
  }

  const feedbackSections = aiResponse ? parseFeedback(aiResponse) : [];

  // Use locale translations for title/description, fall back to API English
  const localizedTitle = t(`scenarios.${scenario.id}.title`, { defaultValue: '' }) || scenario.title;
  const localizedDescription = t(`scenarios.${scenario.id}.description`, { defaultValue: '' }) || scenario.description;

  return (
    <>
      <Stack.Screen options={{ title: localizedTitle }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 + (Platform.OS === 'android' ? insets.bottom : 0) }}
        >
          {/* Scenario header */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CategoryBadge category={scenario.category} />
              {scenario.disease_stage ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: colors.foreground + '0C' }}>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: colors.mutedForeground, textTransform: 'capitalize' }}>
                    {t('scenario.stage_label', { stage: t(`scenario.stages.${scenario.disease_stage}`, scenario.disease_stage) })}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground, lineHeight: 30 }}>
              {localizedTitle}
            </Text>
          </View>

          {/* Situation card — web style: primary/5 bg, 2px border */}
          <View
            style={{
              borderRadius: 18,
              borderCurve: 'continuous',
              borderWidth: 2,
              borderColor: colors.primary + '33',
              backgroundColor: colors.primary + '0A',
              padding: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('scenario.the_situation')}
            </Text>
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 23 }}>
              {localizedDescription}
            </Text>
          </View>

          {/* Response area */}
          {(phase === 'scenario' || phase === 'loading') && (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                {t('scenario.your_response')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <ThemedInput
                    placeholder={t('scenario.response_placeholder')}
                    value={userResponse}
                    onChangeText={setUserResponse}
                    multiline
                    inputStyle={{ minHeight: 130, textAlignVertical: 'top', lineHeight: 24 }}
                  />
                </View>
                <MicButton onTranscript={(text) => setUserResponse((prev) => prev ? prev + ' ' + text : text)} />
              </View>
              {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
              <Button
                size="lg"
                variant="primary"
                loading={phase === 'loading'}
                disabled={!userResponse.trim()}
                onPress={handlePractice}
              >
                {phase === 'loading' ? t('scenario.getting_feedback') : t('scenario.get_feedback')}
              </Button>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', opacity: 0.8, lineHeight: 18 }}>
                {tc('privacy_hint')}
              </Text>
            </View>
          )}

          {/* Feedback display */}
          {phase === 'response' && (
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>
                {t('scenario.your_feedback')}
              </Text>

              {feedbackSections.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {feedbackSections.map((section) => (
                    <View
                      key={section.heading}
                      style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, gap: 8 }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                        {section.heading}
                      </Text>
                      <MarkdownText baseSize={14} lineHeight={22}>{section.content}</MarkdownText>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 }}>
                  <MarkdownText baseSize={15} lineHeight={24}>{aiResponse}</MarkdownText>
                </View>
              )}

              <View style={{ gap: 10, paddingTop: 4 }}>
                <Button variant="secondary" size="lg" onPress={handleTryAgain}>
                  {t('scenario.try_different')}
                </Button>
                <Button variant="ghost" size="md" onPress={() => router.back()}>
                  {tc('nav.back_to_scenarios')}
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
