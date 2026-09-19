import { useTheme } from '@/components/ThemeContext';
import { getAccessCode } from '@/lib/storage';
import { router, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DevSettings,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  applyLocaleChange,
  type SupportedLocale,
} from '@/lib/i18n';

const LOCALE_LIST = [...SUPPORTED_LOCALES];

const CALMGUIDE_LOCKUP = require('../../assets/images/calmguide-lockup.png');
const LEAP_OF_FAITH_LIGHT = require('../../assets/images/leap-of-faith-light.png');

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation('common');
  const [checking, setChecking] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(
    (i18n.language ?? 'en-US') as SupportedLocale,
  );
  const currentLabel = LOCALE_LABELS[currentLocale] ?? currentLocale;

  const handleLanguageSelect = useCallback(
    async (locale: SupportedLocale) => {
      setLangOpen(false);
      const { restartRequired } = await applyLocaleChange(locale);
      setCurrentLocale(locale);
      if (restartRequired) {
        if (__DEV__) {
          DevSettings.reload('Apply RTL direction change');
          return;
        }

        Alert.alert(t('restart.title'), t('restart.message'), [{ text: t('restart.ok') }]);
      }
    },
    [i18n],
  );

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
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 24,
          }}
        >
          {/* Brand. The mark carries the identity, so it is given real size and
              quiet around it rather than being reduced to a line of text. */}
          <View style={{ alignItems: 'center', marginBottom: 36 }}>
            <Image
              source={CALMGUIDE_LOCKUP}
              style={{ width: 236, height: 44 }}
              contentFit="contain"
              accessibilityLabel="CalmGuide"
            />
          </View>

          <Text
            style={{
              fontSize: 30,
              lineHeight: 38,
              fontWeight: '700',
              letterSpacing: -0.6,
              color: colors.foreground,
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {t('welcome.tagline')}
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 23,
              color: colors.mutedForeground,
              textAlign: 'center',
              marginBottom: 36,
              paddingHorizontal: 12,
            }}
          >
            {t('welcome.privacy_note')}
          </Text>

          {/* Actions, ranked by weight: one filled primary, one tinted
              secondary, one plain link. */}
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => router.push('/profile/setup')}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                borderRadius: 16,
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
                shadowColor: colors.primary,
                shadowOpacity: 0.32,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.onPrimary }}>
                {t('welcome.get_started')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/login')}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.tileIndigo : colors.surface,
                borderRadius: 16,
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primaryText }}>
                {t('welcome.have_access_code')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/facility/login')}
              accessibilityRole="link"
              style={({ pressed }) => ({
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: colors.mutedForeground }}>
                {t('welcome.facility_login')}
              </Text>
            </Pressable>
          </View>

          {/* Legal + language, deliberately quiet. */}
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push('/terms')}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}
              >
                <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
                  {t('welcome.terms')}
                </Text>
              </Pressable>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.mutedForeground,
                  opacity: 0.4,
                }}
              />
              <Pressable
                onPress={() => router.push('/privacy')}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}
              >
                <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
                  {t('welcome.privacy')}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setLangOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: pressed ? colors.tileIndigo : 'transparent',
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.mutedForeground }}>
                {currentLabel}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Partner band, as in the approved product screens. The Leap of Faith
          wordmark ships knocked out to white — the stock logo's near-black
          wordmark disappears against this gradient. */}
      <LinearGradient
        colors={[colors.bandFrom, colors.bandTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <SafeAreaView edges={['bottom']}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              paddingVertical: 16,
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 0.3,
              }}
            >
              {t('welcome.partnered_with', 'Partnered with')}
            </Text>
            <Image
              source={LEAP_OF_FAITH_LIGHT}
              style={{ width: 118, height: 34 }}
              contentFit="contain"
              accessibilityLabel="Leap of Faith"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(6, 31, 96, 0.45)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setLangOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              width: 280,
              maxHeight: 440,
              overflow: 'hidden',
            }}
          >
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
                      paddingVertical: 15,
                      backgroundColor: isActive
                        ? colors.tileIndigo
                        : pressed
                          ? `${colors.foreground}08`
                          : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: isActive ? colors.primaryText : colors.foreground,
                        fontWeight: isActive ? '600' : '400',
                      }}
                    >
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
  );
}
