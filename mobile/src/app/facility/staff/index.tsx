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
import { getStaffList, type StaffDetail } from '@/lib/facility-api';
import { getFacilityCode } from '@/lib/facility-storage';

export default function StaffListScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [staff, setStaff] = useState<StaffDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStaff = useCallback(async () => {
    const code = await getFacilityCode();
    if (!code) return;
    try {
      const list = await getStaffList(code);
      setStaff(list);
    } catch { /* handled by empty state */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStaff().finally(() => setLoading(false));
  }, [loadStaff]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStaff();
    setRefreshing(false);
  }, [loadStaff]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground }}>
            {t('staff.title')}
          </Text>
          <Button size="sm" onPress={() => router.push('/facility/staff/new')}>
            {t('staff.add_staff')}
          </Button>
        </View>

        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 16 }}>
          {t('staff.showing_active', { count: staff.length })}
        </Text>

        {staff.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
              {t('empty.staff_title')}
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', maxWidth: 300, marginBottom: 24 }}>
              {t('empty.staff_description')}
            </Text>
            <Button onPress={() => router.push('/facility/staff/new')}>
              {t('empty.staff_cta')}
            </Button>
          </View>
        )}

        {staff.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/facility/staff/${s.id}/assign`)}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            })}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                {s.name}
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                {s.role === 'staff' ? t('staff.role_staff') : s.role === 'admin' ? t('staff.role_admin') : s.role}
                {' · '}{s.assigned_patients_count} {t('staff.residents_col').toLowerCase()}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: s.last_login_at ? colors.success : colors.mutedForeground }}>
              {s.last_login_at ? formatRelative(s.last_login_at) : t('staff.inactive')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}
