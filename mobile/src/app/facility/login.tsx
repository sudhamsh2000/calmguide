import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { PinPad } from '@/components/facility/PinPad';
import { StaffSelector } from '@/components/facility/StaffSelector';
import {
  getActiveStaff,
  pinLogin,
  emailLogin,
  PinError,
  type StaffListItem,
} from '@/lib/facility-api';
import {
  getFacilityCode,
  getFacilityName,
  setFacilityCode,
  setFacilityName,
  setToken,
  setStoredStaff,
  toStaffRole,
} from '@/lib/facility-storage';

type Phase = 'code' | 'select' | 'pin' | 'email';

export default function FacilityLoginScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('code');
  const [facilityCode, setFacilityCodeInput] = useState('');
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffListItem | null>(null);
  const [facilityName, setFacilityNameLocal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const pinErrorKey = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([getFacilityCode(), getFacilityName()]).then(([code, name]) => {
      if (!active) return;
      if (name) setFacilityNameLocal(name);
      if (code) {
        setFacilityCodeInput(code);
        loadStaff(code);
      }
    });
    return () => { active = false; };
  }, []);

  const loadStaff = useCallback(async (code: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { resolveApiBase } = await import('@/lib/facility-api');
      const apiBase = resolveApiBase();
      const [verifyRes, list] = await Promise.all([
        fetch(`${apiBase}/api/facilities/${encodeURIComponent(code)}/verify`).then(r => r.ok ? r.json() : null),
        getActiveStaff(code),
      ]);
      if (verifyRes?.name) {
        setFacilityNameLocal(verifyRes.name);
        await setFacilityName(verifyRes.name);
      }
      if (list.length === 0) {
        setError(t('login.no_staff'));
        setPhase('code');
      } else {
        setStaffList(list);
        setPhase('select');
      }
    } catch {
      setError(t('login.connection_error'));
      setPhase('code');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [t]);

  const handleCodeSubmit = useCallback(async () => {
    const code = facilityCode.trim().toUpperCase();
    if (code.length !== 8) {
      setError(t('login.facility_code_error'));
      return;
    }
    await setFacilityCode(code);
    await loadStaff(code);
  }, [facilityCode, loadStaff, t]);

  const handleStaffSelect = useCallback((staff: StaffListItem) => {
    setSelectedStaff(staff);
    setPinError(null);
    setIsLocked(false);
    setPhase('pin');
  }, []);

  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (!selectedStaff) return;
      setLoading(true);
      setPinError(null);
      try {
        const result = await pinLogin(facilityCode.trim().toUpperCase(), selectedStaff.id, pin);
        await setToken(result.token, result.expires_at);
        await setStoredStaff({
          id: result.staff.id,
          name: result.staff.name,
          role: toStaffRole(result.staff.role),
          language_preference: result.staff.language_preference,
        });
        if (result.staff.role === 'admin' || result.staff.role === 'owner') {
          router.replace('/facility/(tabs)/dashboard');
        } else {
          router.replace('/facility/(tabs)/residents');
        }
      } catch (err) {
        if (err instanceof PinError) {
          if (err.code === 'ACCOUNT_LOCKED') {
            setIsLocked(true);
            setPinError(t('login.account_locked'));
          } else {
            pinErrorKey.current += 1;
            setPinError(t('login.incorrect_pin'));
          }
        } else {
          setPinError(t('login.pin_connection_error'));
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedStaff, facilityCode, router, t],
  );

  const handleEmailLogin = useCallback(async () => {
    setLoading(true);
    setEmailError(null);
    try {
      const data = await emailLogin(email, password);
      await setToken(data.token, data.expires_at);
      await setStoredStaff({
        id: data.staff.id,
        name: data.staff.name,
        role: toStaffRole(data.staff.role),
        language_preference: data.staff.language_preference,
      });
      if (data.staff.role === 'admin' || data.staff.role === 'owner') {
        router.replace('/facility/(tabs)/dashboard');
      } else {
        router.replace('/facility/(tabs)/residents');
      }
    } catch (err) {
      if (err instanceof PinError && err.code === 'ACCOUNT_LOCKED') {
        setEmailError(t('login.email_locked'));
      } else {
        setEmailError(t('login.invalid_credentials'));
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, router, t]);

  const handleBack = useCallback(() => {
    if (phase === 'pin') {
      setSelectedStaff(null);
      setPinError(null);
      setPhase('select');
    } else if (phase === 'select') {
      setPhase('code');
    } else if (phase === 'email') {
      setPhase('code');
      setEmailError(null);
    }
  }, [phase]);

  const firstName = selectedStaff?.name.split(/\s+/)[0] ?? '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'code' && (
          <View style={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
            {facilityName ? (
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16, textAlign: 'center' }}>
                {facilityName}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: colors.foreground,
                alignSelf: 'flex-start',
                marginBottom: 6,
              }}
            >
              {t('login.facility_code')}
            </Text>

            <TextInput
              value={facilityCode}
              onChangeText={(text) => {
                setFacilityCodeInput(text.toUpperCase());
                setError(null);
              }}
              placeholder={t('login.facility_code_placeholder')}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={{
                width: '100%',
                height: 56,
                borderWidth: 1.5,
                borderColor: error ? colors.error : colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                fontSize: 20,
                fontWeight: '600',
                color: colors.foreground,
                backgroundColor: colors.surface,
                textAlign: 'center',
                letterSpacing: 4,
              }}
              accessibilityLabel={t('login.facility_code')}
            />

            {error && (
              <Text
                style={{
                  color: colors.error,
                  fontSize: 14,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                {error}
              </Text>
            )}

            <Button
              onPress={handleCodeSubmit}
              loading={loading}
              disabled={facilityCode.trim().length !== 8}
              size="lg"
              style={{ width: '100%', marginTop: 24 }}
            >
              {t('login.continue')}
            </Button>

            <Pressable
              onPress={() => setPhase('email')}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 16, paddingVertical: 8 })}
            >
              <Text style={{ fontSize: 14, color: colors.primary, textAlign: 'center' }}>
                {t('login.admin_email_link')}
              </Text>
            </Pressable>
          </View>
        )}

        {phase === 'select' && (
          <View style={{ width: '100%', maxWidth: 500, alignItems: 'center' }}>
            {facilityName ? (
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                {facilityName}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                color: colors.foreground,
                marginBottom: 24,
                textAlign: 'center',
              }}
            >
              {t('login.who_is_here')}
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <StaffSelector
                staff={staffList.filter((s) => s.role === 'staff')}
                selectedId={selectedStaff?.id ?? null}
                onSelect={handleStaffSelect}
              />
            )}

            <Button
              variant="ghost"
              onPress={handleBack}
              style={{ marginTop: 24 }}
            >
              {t('login.change_facility')}
            </Button>
          </View>
        )}

        {phase === 'pin' && (
          <View style={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
            {facilityName ? (
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                {facilityName}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: colors.foreground,
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              {t('login.hello', { name: selectedStaff?.name ?? '' })}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.mutedForeground,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              {t('login.enter_pin')}
            </Text>

            <PinPad
              key={pinErrorKey.current}
              onComplete={handlePinComplete}
              error={pinError}
              disabled={loading}
              locked={isLocked}
              onBackToSelect={handleBack}
            />

            {loading && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginTop: 12 }}
              />
            )}

            <Button
              variant="ghost"
              onPress={handleBack}
              style={{ marginTop: 16 }}
            >
              {t('login.not_you', { name: firstName })}
            </Button>
          </View>
        )}

        {phase === 'email' && (
          <View style={{ width: '100%', maxWidth: 400, gap: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '600', color: colors.foreground }}>
              {t('login.admin_login')}
            </Text>

            <View>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground, marginBottom: 6 }}>
                {t('login.email')}
              </Text>
              <TextInput
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(null); }}
                placeholder={t('login.email_placeholder')}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={{
                  height: 48,
                  borderWidth: 2,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground, marginBottom: 6 }}>
                {t('login.password')}
              </Text>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setEmailError(null); }}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoComplete="current-password"
                style={{
                  height: 48,
                  borderWidth: 2,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            {emailError && (
              <Text style={{ color: colors.error, fontSize: 14, textAlign: 'center' }}>
                {emailError}
              </Text>
            )}

            <Button
              onPress={handleEmailLogin}
              loading={loading}
              disabled={!email || !password}
              size="lg"
            >
              {t('login.sign_in')}
            </Button>

            <Pressable
              onPress={handleBack}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}
            >
              <Text style={{ fontSize: 14, color: colors.primary, textAlign: 'center' }}>
                {t('login.back_to_staff')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
