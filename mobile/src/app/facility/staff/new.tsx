import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { createStaff } from '@/lib/facility-api';
import { getFacilityCode } from '@/lib/facility-storage';

type StaffRole = 'staff' | 'admin';

// Must stay in step with SUPPORTED_LOCALES in src/lib/i18n.ts — offering a
// staff member a language the app can no longer render would set a preference
// that silently falls back to English. The web equivalent lists the same three.
const LANGUAGES = [
  { value: 'en-US', label: 'English' },
  { value: 'es-ES', label: 'Español' },
  { value: 'hi-IN', label: 'हिन्दी' },
] as const;

export default function AddStaffScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('staff');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [saving, setSaving] = useState(false);

  const isAdmin = role === 'admin';

  const generatePin = () => {
    const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
    setPin(digits);
  };

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    if (isAdmin && !email.trim()) {
      Alert.alert(t('staff.email_label'), t('staff.email_hint_admin'));
      return;
    }
    if (isAdmin && password.length < 8) {
      Alert.alert(
        t('login.password'),
        t('staff.password_min_length', 'Password must be at least 8 characters.'),
      );
      return;
    }

    setSaving(true);
    try {
      const code = await getFacilityCode();
      if (!code) return;
      await createStaff(code, {
        name: name.trim(),
        role,
        pin: pin || undefined,
        email: email.trim() || undefined,
        password: isAdmin ? password : undefined,
        language_preference: language,
      });
      router.back();
    } catch {
      Alert.alert(
        'Error',
        t('add_resident.error', 'Could not create staff member. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  }, [name, role, pin, email, password, language, isAdmin, router, t]);

  const inputStyle = {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.surface,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 24 }}
        >
          {t('staff.add_title')}
        </Text>

        <Text
          style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}
        >
          {t('staff.name')}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.mutedForeground}
          style={[inputStyle, { marginBottom: 16 }]}
          accessibilityLabel={t('staff.name')}
        />

        <Text
          style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}
        >
          {t('staff.role')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {(['staff', 'admin'] as const).map((r) => (
            <Button
              key={r}
              variant={role === r ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setRole(r)}
            >
              {r === 'staff' ? t('staff.role_staff') : t('staff.role_admin')}
            </Button>
          ))}
        </View>

        <Text
          style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}
        >
          {t('staff.pin_label')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TextInput
            value={pin}
            onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={6}
            style={[inputStyle, { flex: 1 }]}
            accessibilityLabel={t('staff.pin_label')}
          />
          <Button
            variant="secondary"
            size="sm"
            onPress={generatePin}
            style={{ alignSelf: 'center' }}
          >
            {t('staff.pin_generate')}
          </Button>
        </View>

        <Text
          style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}
        >
          {t('staff.email_label')}
          <Text style={{ fontSize: 12, fontWeight: '400', color: colors.mutedForeground }}>
            {' '}
            ({isAdmin ? t('staff.email_hint_admin') : t('staff.email_hint_cna')})
          </Text>
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={isAdmin ? t('staff.email_hint_admin') : t('staff.email_hint_cna')}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[inputStyle, { marginBottom: 16 }]}
          accessibilityLabel={t('staff.email_label')}
        />

        {isAdmin && (
          <>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}
            >
              {t('login.password')} *
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoComplete="new-password"
              style={[inputStyle, { marginBottom: 16 }]}
              accessibilityLabel={t('login.password')}
            />
          </>
        )}

        <Text
          style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}
        >
          {t('staff.language_label')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
          {LANGUAGES.map((lang) => (
            <Button
              key={lang.value}
              variant={language === lang.value ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setLanguage(lang.value)}
            >
              {lang.label}
            </Button>
          ))}
        </View>

        <Button size="lg" onPress={handleSave} loading={saving} disabled={!name.trim()}>
          {t('staff.add_button')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
