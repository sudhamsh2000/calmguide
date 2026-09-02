import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { clearFacilitySession, getFacilityCode, getFacilityName } from '@/lib/facility-storage';
import { getFacility, type FacilityInfo } from '@/lib/facility-api';

export default function FacilitySettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [facilityCode, setCode] = useState('');
  const [facilityName, setName] = useState('');
  const [facility, setFacility] = useState<FacilityInfo | null>(null);

  const handleLogOut = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await clearFacilitySession();
    router.replace('/facility/login');
  };

  useEffect(() => {
    Promise.all([getFacilityCode(), getFacilityName()]).then(async ([code, name]) => {
      setCode(code ?? '');
      setName(name ?? '');
      if (code) {
        try {
          const info = await getFacility(code);
          setFacility(info);
        } catch {
          /* silent */
        }
      }
    });
  }, []);

  const rowStyle = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text
          style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 20 }}
        >
          {t('settings.title')}
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 20,
          }}
        >
          <View style={rowStyle}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
              {t('settings.facility_name')}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              {facilityName}
            </Text>
          </View>
          <View style={rowStyle}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
              {t('settings.facility_code')}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.foreground,
                fontFamily: 'monospace',
              }}
            >
              {facilityCode}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 8 }}>
            {t('settings.facility_code_hint')}
          </Text>
        </View>

        {facility && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 20,
              flexDirection: 'row',
              gap: 24,
            }}
          >
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
                {facility.patient_count}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {t('settings.linked_patients')}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
                {facility.staff_count}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {t('settings.active_staff')}
              </Text>
            </View>
          </View>
        )}

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 }}
          >
            {t('settings.alert_thresholds')}
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 8 }}>
            {t('settings.alert_notify_when')}
          </Text>
          {[
            t('settings.alert_severe'),
            t('settings.alert_threshold', { count: 2, period: '1' }),
            t('settings.alert_inactive', { days: 3 }),
            t('settings.alert_family'),
          ].map((label) => (
            <View
              key={label}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                  marginEnd: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{'✓'}</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }}>{label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleLogOut}
          accessibilityRole="button"
          accessibilityLabel={t('settings.log_out')}
          style={({ pressed }) => ({
            marginTop: 8,
            marginBottom: insets.bottom + 8,
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: colors.isDark ? '#3D1A18' : '#FEF2F2',
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.error }}>
            {t('settings.log_out')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
