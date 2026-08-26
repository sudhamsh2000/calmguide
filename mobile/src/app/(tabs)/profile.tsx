import { Button } from '@/components/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeContext';
import { LOCALE_LABELS, SUPPORTED_LOCALES, applyLocaleChange, resolveSupportedLocale, type SupportedLocale } from '@/lib/i18n';
import { getProfile, type ProfileResponse } from '@/lib/api';
import { clearAll, getAccessCode, getPatientName } from '@/lib/storage';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DevSettings, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type DiseaseStage = 'early' | 'middle' | 'late';

const avatarBg: Record<DiseaseStage, string> = {
  early: '#00B89418',
  middle: '#FDCB6E22',
  late: '#7B8FA118',
};
const avatarText: Record<DiseaseStage, string> = {
  early: '#00B894',
  middle: '#C8973A',
  late: '#7B8FA1',
};

function SectionLabel({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary + 'BB', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>
      {title}
    </Text>
  );
}

function ChipGroup({ items, color }: { items: string[]; color?: string }) {
  const { colors } = useTheme();
  const chipColor = color ?? colors.primary;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <View key={item} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: chipColor + '1A' }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: chipColor, textTransform: 'capitalize' }}>
            {item.replace(/_/g, ' ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('profile');
  const { t: tc, i18n } = useTranslation('common');
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [patientName, setPatientNameState] = useState('');
  const [accessCode, setAccessCodeState] = useState('');
  const [loading, setLoading] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [changingLanguage, setChangingLanguage] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const translateOption = (group: 'behavioral' | 'calming' | 'safety', value: string): string =>
    t(`options.${group}.${value}`, value);
  const currentLocale = resolveSupportedLocale(i18n.language) ?? 'en-US';

  async function handleLanguageChange(locale: SupportedLocale) {
    if (changingLanguage) return;

    if (locale === currentLocale) {
      setLanguageOpen(false);
      return;
    }

    setChangingLanguage(true);
    try {
      const { restartRequired } = await applyLocaleChange(locale);
      setLanguageOpen(false);

      if (restartRequired) {
        if (__DEV__) {
          DevSettings.reload('Apply RTL direction change');
          return;
        }

        Alert.alert(
          tc('restart.title'),
          tc('restart.message'),
          [{ text: tc('restart.ok') }],
        );
      }
    } finally {
      setChangingLanguage(false);
    }
  }

  const load = useCallback(async () => {
    const code = await getAccessCode();
    const name = await getPatientName();
    if (!code) { router.replace('/'); return; }
    setAccessCodeState(code);
    setPatientNameState(name ?? '');
    try {
      const p = await getProfile(code);
      setProfile(p);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSignOut() {
    Alert.alert(
      t('sign_out.title', 'Sign Out'),
      t('sign_out.message', 'This will clear your access code and patient name from this device. Your clinical profile will remain on the server.'),
      [
        { text: t('sign_out.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('sign_out.confirm', 'Sign Out'),
          style: 'destructive',
          onPress: async () => { await clearAll(); router.replace('/'); },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const diseaseStage = (profile?.disease_stage ?? 'middle') as DiseaseStage;
  const initial = patientName.charAt(0).toUpperCase();

  // Format code: "KM7X · 4PQ2"
  const formattedCode = accessCode.length === 8
    ? `${accessCode.slice(0, 4)}  ·  ${accessCode.slice(4)}`
    : accessCode;

  return (
    <>
      <Stack.Screen options={{ title: t('view.title', 'Patient Profile') }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 48, paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
      >
        {/* Name card */}
        <View style={{ marginHorizontal: 20, marginTop: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: avatarBg[diseaseStage],
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Text style={{ color: avatarText[diseaseStage], fontSize: 22, fontWeight: '700' }}>
                {initial}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.foreground }}>{patientName}</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{t('view.name_hint', 'Name stored on your device only')}</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <View style={{ marginHorizontal: 20, marginTop: 24, gap: 0 }}>

          {/* Disease Stage */}
          <View style={{ paddingBottom: 20 }}>
            <SectionLabel title={t('view.dementia_stage', 'Dementia Stage')} />
            <Text style={{ fontSize: 16, fontWeight: '500', color: colors.foreground }}>
              {t(`view.${diseaseStage}_stage`, diseaseStage)}
            </Text>
          </View>
          <Divider />

          {/* Behavioral patterns */}
          <View style={{ paddingVertical: 20 }}>
            <SectionLabel title={t('view.behavioral_patterns', 'Behavioral Patterns')} />
            {(profile?.behavioral_patterns?.length ?? 0) > 0 ? (
              <ChipGroup
                items={profile!.behavioral_patterns.map((v) => translateOption('behavioral', v))}
                color={colors.primary}
              />
            ) : (
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('view.none_recorded', 'None recorded')}</Text>
            )}
          </View>
          <Divider />

          {/* Calming strategies */}
          <View style={{ paddingVertical: 20 }}>
            <SectionLabel title={t('view.calming_strategies', 'Calming Strategies')} />
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 24 }}>
              {(profile?.calming_strategies?.length ?? 0) > 0
                ? profile!.calming_strategies.map((v) => translateOption('calming', v)).join(', ')
                : t('view.none_recorded', 'None recorded')}
            </Text>
          </View>
          <Divider />

          {/* Safety concerns */}
          <View style={{ paddingVertical: 20 }}>
            <SectionLabel title={t('view.safety_concerns', 'Safety Concerns')} />
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 24 }}>
              {(profile?.safety_concerns?.length ?? 0) > 0
                ? profile!.safety_concerns.map((v) => translateOption('safety', v)).join(', ')
                : t('view.none_recorded', 'None recorded')}
            </Text>
          </View>

          {/* Access code card */}
          <View
            style={{
              borderRadius: 18,
              backgroundColor: colors.foreground + '08',
              paddingHorizontal: 20,
              paddingVertical: 24,
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.4 }}>
              {t('view.access_code', 'Your Access Code')}
            </Text>
            <Text
              selectable={showCode}
              style={{ fontSize: 26, fontWeight: '700', color: colors.primary, letterSpacing: 3, fontVariant: ['tabular-nums'] }}
            >
              {showCode ? formattedCode : '••••••••'}
            </Text>
            <Pressable
              onPress={() => setShowCode((v) => !v)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 10, paddingHorizontal: 12 })}
              accessibilityRole="button"
              accessibilityLabel={showCode ? t('view.hide_code', 'Hide access code') : t('view.show_code', 'Show access code')}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                {showCode ? t('view.hide_code', 'Hide') : t('view.show_code', 'Show')}
              </Text>
            </Pressable>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>
              {t('view.access_code_hint', 'Save this code to access your profile from another device')}
            </Text>
          </View>

          {/* Actions */}
          <Button
            variant="secondary"
            size="lg"
            onPress={() => router.push('/profile/edit')}
            style={{ marginBottom: 10 }}
          >
            {t('actions.edit', 'Edit Profile')}
          </Button>

          {/* Theme toggle row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '500' }}>
              {t('appearance', 'Appearance')}
            </Text>
            <ThemeToggle />
          </View>

          <Pressable
            onPress={() => setLanguageOpen((open) => !open)}
            disabled={changingLanguage}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: 10,
              opacity: pressed || changingLanguage ? 0.75 : 1,
            })}
            accessibilityRole="button"
            accessibilityState={{ expanded: languageOpen }}
            accessibilityLabel={`${tc('language.label', 'Language')}: ${LOCALE_LABELS[currentLocale]}`}
            accessibilityHint={languageOpen ? 'Collapse language picker' : 'Expand language picker'}
          >
            <View style={{ flex: 1, paddingEnd: 12 }}>
              <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '500' }}>
                {tc('language.label', 'Language')}
              </Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 2 }}>
                {LOCALE_LABELS[currentLocale]}
              </Text>
            </View>
            {changingLanguage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text aria-hidden style={{ fontSize: 18, color: colors.mutedForeground }}>
                {languageOpen ? '▴' : '▾'}
              </Text>
            )}
          </Pressable>

          {languageOpen ? (
            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              {SUPPORTED_LOCALES.map((locale, index) => {
                const isSelected = locale === currentLocale;
                return (
                  <Pressable
                    key={locale}
                    onPress={() => { void handleLanguageChange(locale); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                      backgroundColor: pressed ? colors.foreground + '08' : 'transparent',
                    })}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={{ fontSize: 15, color: isSelected ? colors.primary : colors.foreground, fontWeight: isSelected ? '600' : '500' }}>
                      {LOCALE_LABELS[locale]}
                    </Text>
                    {isSelected ? (
                      <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Button variant="ghost" size="md" onPress={handleSignOut}>
            {t('sign_out.title', 'Sign Out')}
          </Button>

          {/* Legal links */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Pressable onPress={() => router.push('/terms')} accessibilityRole="link">
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{tc('nav.terms')}</Text>
            </Pressable>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, opacity: 0.4 }}>·</Text>
            <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link">
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{tc('nav.privacy')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
