import { useTheme } from '@/components/ThemeContext';
import { getImpact, type ImpactResponse } from '@/lib/api';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

function Stat({
  value,
  label,
  sub,
  colors,
}: {
  value: string | number;
  label: string;
  sub?: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 4,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 20,
      }}
    >
      <Text style={{ fontSize: 32, fontWeight: '700', color: colors.foreground }}>{value}</Text>
      <Text
        style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, textAlign: 'center' }}
      >
        {label}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center' }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export default function ImpactScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('impact');
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getImpact()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Impact' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: 40,
          paddingTop: Platform.OS === 'android' ? insets.top + 20 : 20,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: '500', color: colors.foreground, lineHeight: 32 }}>
          {t('title')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('subtitle')}</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : data ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stat
                colors={colors}
                value={data.families_supported.toLocaleString()}
                label={t('families_supported')}
                sub={t('families_supported_sub')}
              />
              <Stat
                colors={colors}
                value={data.coached_sessions.toLocaleString()}
                label={t('coached_sessions')}
                sub={t('coached_sessions_sub')}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stat
                colors={colors}
                value={data.languages_served}
                label={t('languages_served')}
                sub={t('languages_served_sub')}
              />
              <Stat
                colors={colors}
                value={`${data.overnight_pct}%`}
                label={t('overnight_pct')}
                sub={t('overnight_pct_sub')}
              />
            </View>

            <View
              style={{
                borderRadius: 18,
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 20,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 28, fontWeight: '700', color: colors.onPrimary }}>
                {data.sessions_this_week.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                {t('sessions_this_week')}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
                textAlign: 'center',
                fontStyle: 'italic',
                marginTop: 8,
              }}
            >
              {t('closing')}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 32 }}>
            {t('unavailable')}
          </Text>
        )}
      </ScrollView>
    </>
  );
}
