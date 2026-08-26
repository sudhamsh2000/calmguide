import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { ResidentCard } from '@/components/facility/ResidentCard';
import { TopBar } from '@/components/facility/TopBar';
import { getMyResidents, type ResidentCard as ResidentCardData } from '@/lib/facility-api';
import {
  clearFacilitySession,
  getFacilityName,
  getStoredStaff,
  type StoredStaff,
} from '@/lib/facility-storage';
import { useFacilitySessionGuard } from '../../../hooks/useFacilitySessionGuard';

export default function ResidentsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [residents, setResidents] = useState<ResidentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StoredStaff | null>(null);
  const [facilityName, setFacilityNameState] = useState('');

  const { recordActivity } = useFacilitySessionGuard();

  const loadData = useCallback(async () => {
    try {
      const [data, staffData, name] = await Promise.all([
        getMyResidents(),
        getStoredStaff(),
        getFacilityName(),
      ]);
      setResidents(data);
      setStaff(staffData);
      setFacilityNameState(name ?? '');
      setError(null);
    } catch {
      setError('Resident list unavailable right now. Your residents are still on record.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    recordActivity();
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData, recordActivity]);

  const handleQuickSwitch = useCallback(async () => {
    await clearFacilitySession();
    router.replace('/facility/login');
  }, [router]);

  const keyExtractor = useCallback((item: ResidentCardData) => item.profile_id, []);

  const renderItem = useCallback(({ item: r }: { item: ResidentCardData }) => (
    <View style={{ marginBottom: 12 }}>
      <ResidentCard
        resident={r}
        onPress={() => {
          recordActivity();
          const params = new URLSearchParams();
          if (r.unit) params.set('unit', r.unit);
          if (r.room) params.set('room', r.room);
          if (r.bed) params.set('bed', r.bed);
          params.set('risk', r.risk_level);
          router.push(`/facility/residents/${r.profile_id}?${params.toString()}`);
        }}
      />
    </View>
  ), [recordActivity, router]);

  const listHeader = (
    <>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: colors.foreground,
          marginBottom: 16,
        }}
      >
        {t('residents.title')}
      </Text>

      {error && (
        <View
          style={{
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.error,
          }}
        >
          <Text style={{ color: colors.error, fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
          <Button variant="secondary" onPress={handleRefresh} style={{ marginTop: 12 }}>
            Retry
          </Button>
        </View>
      )}
    </>
  );

  const listEmpty = !error ? (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
        {t('residents.no_residents')}
      </Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', maxWidth: 300 }}>
        {t('residents.no_residents_subtitle')}
      </Text>
    </View>
  ) : null;

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
        onQuickSwitch={handleQuickSwitch}
      />

      <FlatList
        data={residents}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onScrollBeginDrag={recordActivity}
        removeClippedSubviews
        initialNumToRender={10}
        windowSize={11}
      />
    </View>
  );
}
