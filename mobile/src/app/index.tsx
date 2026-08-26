import { Button } from '@/components/Button';
import { useTheme } from '@/components/ThemeContext';
import { getAccessCode } from '@/lib/storage';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DevSettings, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LOCALE_LABELS, SUPPORTED_LOCALES, applyLocaleChange, type SupportedLocale } from '@/lib/i18n';

const LOCALE_LIST = [...SUPPORTED_LOCALES];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('common');
  const [checking, setChecking] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(
    (i18n.language ?? 'en-US') as SupportedLocale,
  );
  const currentLabel = LOCALE_LABELS[currentLocale] ?? currentLocale;

  const handleLanguageSelect = useCallback(async (locale: SupportedLocale) => {
    setLangOpen(false);
    const { restartRequired } = await applyLocaleChange(locale);
    setCurrentLocale(locale);
    if (restartRequired) {
      if (__DEV__) {
        DevSettings.reload('Apply RTL direction change');
        return;
      }

      Alert.alert(
        t('restart.title'),
        t('restart.message'),
        [{ text: t('restart.ok') }],
      );
    }
  }, [i18n]);

  useEffect(() => {
    getAccessCode().then((code) => {
      if (code) {
        router.replace('/(tabs)/home');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingVertical: 60,
        }}
      >
      {/* Logo + headline */}
      <View style={{ alignItems: 'center', marginBottom: 44 }}>
        <Text style={{ fontSize: 42, letterSpacing: -1, marginBottom: 14 }}>
          <Text style={{ fontWeight: '800', color: colors.primary }}>Calm</Text>
          <Text style={{ fontWeight: '300', color: colors.primary }}>Guide</Text>
        </Text>
        <Text
          style={{
            fontSize: 18,
            color: colors.mutedForeground,
            textAlign: 'center',
            lineHeight: 27,
            maxWidth: 280,
          }}
        >
          {t('welcome.tagline')}
        </Text>
      </View>

      {/* CTAs */}
      <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 12 }}>
        <Button
          size="lg"
          variant="primary"
          onPress={() => router.push('/profile/setup')}
          style={{ alignSelf: 'stretch', minHeight: 52 }}
        >
          {t('welcome.get_started')}
        </Button>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 12, minHeight: 44, justifyContent: 'center' })}
          accessibilityRole="link"
        >
          <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '500' }}>
            {t('welcome.have_access_code')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/facility/login')}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 12, minHeight: 44, justifyContent: 'center' })}
          accessibilityRole="link"
        >
          <Text style={{ fontSize: 16, color: colors.mutedForeground, fontWeight: '500' }}>
            {t('welcome.facility_login')}
          </Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={{ marginTop: 52, alignItems: 'center', gap: 12 }}>
        <Text
          style={{
            fontSize: 14,
            color: colors.mutedForeground,
            textAlign: 'center',
            lineHeight: 21,
            opacity: 0.85,
          }}
        >
          {t('welcome.privacy_note')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.push('/terms')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('welcome.terms')}</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, opacity: 0.4 }}>·</Text>
          <Pressable onPress={() => router.push('/privacy')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('welcome.privacy')}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setLangOpen(true)}
          style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}
        >
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{currentLabel}</Text>
        </Pressable>
        <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
            <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setLangOpen(false)} />
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, width: 280, maxHeight: 440, overflow: 'hidden' }}>
              <FlatList
                data={LOCALE_LIST}
                keyExtractor={(item) => item}
                renderItem={({ item: locale }) => {
                  const isActive = locale === currentLocale;
                  return (
                    <Pressable
                      onPress={() => handleLanguageSelect(locale)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        backgroundColor: isActive ? `${colors.primary}10` : pressed ? `${colors.foreground}08` : 'transparent',
                      })}
                    >
                      <Text style={{
                        fontSize: 16,
                        color: isActive ? colors.primary : colors.foreground,
                        fontWeight: isActive ? '600' : '400',
                      }}>
                        {LOCALE_LABELS[locale]}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
