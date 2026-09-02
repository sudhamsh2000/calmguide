import { Button } from '@/components/Button';
import { ThemedInput } from '@/components/ThemedInput';
import { useTheme } from '@/components/ThemeContext';
import { getProfile } from '@/lib/api';
import { setAccessCode, setPatientName } from '@/lib/storage';
import { ACCESS_CODE_LENGTH, sanitizeAccessCode, validateLoginInput } from '@/lib/login-validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const CODE_LENGTH = ACCESS_CODE_LENGTH;

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation('common');
  const [accessCode, setAccessCodeState] = useState('');
  const [patientName, setPatientNameState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    const result = validateLoginInput(accessCode, patientName);
    if (!result.valid) {
      setError(
        result.error === 'incomplete_code'
          ? t('login.error_incomplete_code')
          : t('login.error_missing_name'),
      );
      return;
    }
    const code = result.code;
    setLoading(true);
    try {
      await getProfile(code);
      await setAccessCode(code);
      await setPatientName(patientName.trim());
      router.replace('/(tabs)/home');
    } catch {
      setError(t('login.error_not_found'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 160 }}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>
              {t('login.subtitle')}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <ThemedInput
              label={t('login.code_label')}
              placeholder="ABCD1234"
              value={accessCode}
              onChangeText={(value) => {
                setAccessCodeState(sanitizeAccessCode(value));
                if (error) setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType="ascii-capable"
              returnKeyType="next"
              inputStyle={{
                textAlign: 'center',
                fontSize: 24,
                fontWeight: '800',
                letterSpacing: 5,
              }}
            />
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }}>
              {t('login.code_hint')}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <ThemedInput
              label={t('login.name_label')}
              placeholder={t('login.name_placeholder')}
              value={patientName}
              onChangeText={setPatientNameState}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 18 }}>
              {t('login.name_hint')}
            </Text>
          </View>

          {error ? (
            <View
              style={{
                backgroundColor: colors.error + '18',
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.error + '44',
              }}
            >
              <Text style={{ color: colors.error, fontSize: 14, lineHeight: 20 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
              {t('login.no_code')}
            </Text>
            <Pressable
              onPress={() => router.push('/profile/setup')}
              accessibilityRole="link"
              accessibilityLabel={t('login.setup_new')}
            >
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>
                {t('login.setup_new')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background + 'F2',
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <Button size="lg" loading={loading} onPress={handleSubmit}>
            {loading ? t('login.submitting') : t('login.submit')}
          </Button>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
