import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { KpiCard } from '@/components/facility/KpiCard';
import { TopBar } from '@/components/facility/TopBar';
import {
  clearFacilitySession,
  getFacilityName,
  getStoredStaff,
  type StoredStaff,
} from '@/lib/facility-storage';
import { getDashboardSummary, type DashboardSummary } from '@/lib/facility-api';
import { useFacilitySessionGuard } from '../../../hooks/useFacilitySessionGuard';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();
  const { recordActivity } = useFacilitySessionGuard();

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StoredStaff | null>(null);
  const [facilityName, setFacilityNameState] = useState('');

  // Load staff + facility name immediately on mount (no API needed)
  useEffect(() => {
    Promise.all([getStoredStaff(), getFacilityName()]).then(([s, n]) => {
      if (s) setStaff(s);
      if (n) setFacilityNameState(n);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const summary = await getDashboardSummary(24);
      setData(summary);
      setError(null);
    } catch {
      setError(t('dashboard.unavailable'));
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        facilityName={facilityName}
        staffName={staff?.name ?? ''}
        onQuickSwitch={async () => {
          await clearFacilitySession();
          router.replace('/facility/login');
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        onScrollBeginDrag={recordActivity}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
          {t('dashboard.title')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16 }}>
          {t('dashboard.last_24h')}
        </Text>

        {error && (
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.error }}>
            <Text style={{ color: colors.error, fontSize: 14, textAlign: 'center' }}>{error}</Text>
            <Button variant="secondary" onPress={handleRefresh} style={{ marginTop: 12 }}>{t('dashboard.retry')}</Button>
          </View>
        )}

        {data && (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <KpiCard
                value={String(data.incident_count.total)}
                label={t('dashboard.incidents')}
                sublabel={`${data.incident_count.severe} ${t('dashboard.severe')}`}
                urgency={data.incident_count.severe > 0 ? 'alert' : data.incident_count.total > 5 ? 'warning' : undefined}
              />
              <KpiCard
                value={`${data.staff_adoption.active_users}/${data.staff_adoption.total_staff}`}
                label={t('dashboard.staff_active')}
                sublabel={`${data.staff_adoption.percentage}%`}
                urgency={data.staff_adoption.percentage >= 80 ? 'positive' : data.staff_adoption.percentage < 50 ? 'warning' : undefined}
              />
            </View>

            {data.escalating_residents.length > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.error, marginBottom: 8 }}>
                  {t('dashboard.escalating_residents')}
                </Text>
                {data.escalating_residents.map((r, i) => (
                  <Text key={i} style={{ fontSize: 14, color: colors.foreground, paddingVertical: 4 }}>
                    {/* The dashboard endpoint returns {profile_id, category, trend}
                      * only — there is no `name` on this payload, so the previous
                      * `r.name ?? …` was dead and always fell through to the id. */}
                    {r.profile_id} — {r.trend || t('dashboard.escalating')}
                  </Text>
                ))}
              </View>
            )}

            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
                {t('dashboard.family_activity')}
              </Text>
              <Text style={{ fontSize: 14, color: colors.foreground }}>
                {data.family_sessions.count} {t('dashboard.family_sessions')}
              </Text>
            </View>

            {/* Quick navigation */}
            <View style={{ gap: 8 }}>
              {[
                { label: t('nav.residents'), route: '/facility/residents-all' },
                { label: t('nav.trends'), route: '/facility/trends' },
                { label: t('nav.staff'), route: '/facility/staff/index' },
                { label: t('nav.audit'), route: '/facility/audit' },
                { label: t('nav.settings'), route: '/facility/settings' },
              ].map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, flex: 1 }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 16, color: colors.mutedForeground }}>→</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
