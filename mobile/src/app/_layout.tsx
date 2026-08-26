import "../lib/i18n";
import { EmergencyBar } from '@/components/EmergencyBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider, useTheme } from '@/components/ThemeContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nManager, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getPreferredLanguage } from '@/lib/storage';
import { getDeviceLocale, resolveSupportedLocale } from '@/lib/i18n';

function HeaderBackControl({
  tintColor,
  onPress,
}: {
  tintColor: string;
  onPress: () => void;
}) {
  const isRtl = I18nManager.isRTL;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isRtl ? 'رجوع' : 'Back'}
      hitSlop={10}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text
        style={{
          color: tintColor,
          fontSize: 34,
          lineHeight: 34,
          fontWeight: '300',
          marginTop: -2,
        }}
      >
        {isRtl ? '›' : '‹'}
      </Text>
    </Pressable>
  );
}

function RootStack() {
  const { colors, isDark } = useTheme();
  const { t: tc, i18n } = useTranslation('common');
  const { t: tCoach } = useTranslation('coach');
  const { t: tCheckIn } = useTranslation('checkin');
  const { t: tLearn } = useTranslation('learn');
  const { t: tProfile } = useTranslation('profile');
  const { t: tJourney } = useTranslation('journey');
  const { t: tIncidents } = useTranslation('incidents');
  const { t: tFacility } = useTranslation('facility');
  const [isLocaleReady, setIsLocaleReady] = useState(false);
  const [langKey, setLangKey] = useState(i18n.language);

  useEffect(() => {
    const handler = (lng: string) => setLangKey(lng);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n]);

  useEffect(() => {
    let active = true;

    async function applyLanguagePreference() {
      const preferred = await getPreferredLanguage();
      const nextLocale =
        (preferred ? resolveSupportedLocale(preferred) : null) ?? getDeviceLocale();

      if (i18n.language !== nextLocale) {
        await i18n.changeLanguage(nextLocale);
      }

      if (active) setIsLocaleReady(true);
    }

    void applyLanguagePreference();
    return () => { active = false; };
  }, [i18n]);


  if (!isLocaleReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack
          key={langKey}
          screenOptions={({ navigation }) => {
            const canGoBack = navigation.canGoBack();

            return {
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.foreground, fontWeight: '600' },
              headerTitleAlign: 'center',
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
              headerBackVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              headerLeft: !canGoBack
                ? undefined
                : () => (
                    <HeaderBackControl
                      tintColor={colors.primary}
                      onPress={() => navigation.goBack()}
                    />
                  ),
            };
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: tc('login.title', 'Enter Access Code') }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="coach"
            options={{
              title: tCoach('title', 'Moment Coach'),
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
            }}
          />
          <Stack.Screen name="check-in" options={{ title: tCheckIn('title', 'Check In') }} />
          <Stack.Screen name="profile/setup" options={{ title: tProfile('setup_title', 'Create Profile') }} />
          <Stack.Screen name="profile/edit" options={{ title: tProfile('edit_title', 'Edit Profile') }} />
          <Stack.Screen name="learn/[id]" options={{ title: tLearn('title', 'Practice') }} />
          <Stack.Screen name="terms" options={{ title: tc('nav.terms'), presentation: 'modal' }} />
          <Stack.Screen name="privacy" options={{ title: tc('nav.privacy'), presentation: 'modal' }} />
          <Stack.Screen name="journey/noticing" options={{ title: tJourney('noticing.title') }} />
          <Stack.Screen name="journey/diagnosis" options={{ title: tJourney('diagnosis.title') }} />
          <Stack.Screen name="journey/hospice" options={{ title: tJourney('hospice.title') }} />
          <Stack.Screen name="journey/bereavement" options={{ title: tJourney('bereavement.title') }} />
          <Stack.Screen name="incidents/index" options={{ title: tIncidents('history.title', 'Incident History') }} />
          <Stack.Screen name="incidents/[id]" options={{ title: tIncidents('detail.title', 'Incident Detail') }} />
          <Stack.Screen name="incidents/new" options={{ title: tIncidents('logger.title', 'Log an Incident') }} />
          <Stack.Screen name="facility/login" options={{ title: tFacility('login.facility_code'), headerBackTitle: '' }} />
          <Stack.Screen name="facility/(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="facility/residents-all" options={{ title: tFacility('residents_all.title') }} />
          <Stack.Screen name="facility/residents/[id]" options={{ title: tFacility('residents.behavioral_card') }} />
          <Stack.Screen name="facility/residents/new" options={{ title: tFacility('add_resident.title') }} />
          <Stack.Screen name="facility/staff/index" options={{ title: tFacility('staff.title') }} />
          <Stack.Screen name="facility/staff/new" options={{ title: tFacility('staff.add_title') }} />
          <Stack.Screen name="facility/staff/[id]/assign" options={{ title: tFacility('staff.assign_title', { name: '' }) }} />
          <Stack.Screen name="facility/trends" options={{ title: tFacility('trends.title') }} />
          <Stack.Screen name="facility/executive" options={{ title: tFacility('executive.title') }} />
          <Stack.Screen name="facility/settings" options={{ title: tFacility('settings.title') }} />
          <Stack.Screen name="facility/audit" options={{ title: tFacility('audit.title') }} />
        </Stack>
      </View>
      <EmergencyBar />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <RootStack />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
