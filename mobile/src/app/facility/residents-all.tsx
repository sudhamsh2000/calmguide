import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { getMyResidents, type ResidentCard } from '@/lib/facility-api';

type SortMode = 'risk' | 'room';

const RISK_ORDER = { high: 0, moderate: 1, low: 2 } as const;

const TREND_SYMBOLS: Record<string, string> = {
  spike: '↑↑',
  increasing: '↑',
  stable: '→',
  decreasing: '↓',
};

export default function AllResidentsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [residents, setResidents] = useState<ResidentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('risk');

  const loadResidents = useCallback(async () => {
    try {
      const list = await getMyResidents();
      setResidents(list);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadResidents().finally(() => setLoading(false));
  }, [loadResidents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadResidents();
    setRefreshing(false);
  }, [loadResidents]);

  const sorted = useMemo(() => {
    const filtered = residents.filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.profile_id.toLowerCase().includes(q) ||
        (r.room ?? '').toLowerCase().includes(q) ||
        r.disease_stage.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'risk') {
        return (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3);
      }
      return (a.room ?? '').localeCompare(b.room ?? '');
    });
  }, [residents, search, sortMode]);

  const highCount = sorted.filter((r) => r.risk_level === 'high').length;
  const moderateCount = sorted.filter((r) => r.risk_level === 'moderate').length;
  const lowCount = sorted.filter((r) => r.risk_level === 'low').length;

  const riskColor = useCallback(
    (level: string) => {
      if (level === 'high') return colors.error;
      if (level === 'moderate') return '#F97316';
      return '#22C55E';
    },
    [colors.error],
  );

  const keyExtractor = useCallback((item: ResidentCard) => item.profile_id, []);

  const renderItem = useCallback(
    ({ item: r }: { item: ResidentCard }) => (
      <Pressable
        onPress={() =>
          router.push(
            `/facility/residents/${r.profile_id}?unit=${r.unit ?? ''}&room=${r.room ?? ''}&bed=${r.bed ?? ''}&risk=${r.risk_level}`,
          )
        }
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 14,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
            {r.room
              ? `${t('residents_all.room')} ${r.room}`
              : r.profile_id.slice(0, 8).toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: `${riskColor(r.risk_level)}18`,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: riskColor(r.risk_level) }}>
                {t(`residents.risk_${r.risk_level}`)}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
              {TREND_SYMBOLS[r.trend_direction] ?? '→'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {r.disease_stage
              ? r.disease_stage.charAt(0).toUpperCase() + r.disease_stage.slice(1)
              : '—'}
          </Text>
          {r.last_incident_summary && (
            <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
              {r.last_incident_summary}
            </Text>
          )}
        </View>
      </Pressable>
    ),
    [colors, router, t, riskColor],
  );

  // Header content scrolls with the list. Kept in ListHeaderComponent (not a
  // sibling) so it scrolls away; the search TextInput stays mounted because the
  // FlatList itself never remounts.
  const listHeader = (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground }}>
          {t('residents_all.title')}
        </Text>
        <Button size="sm" onPress={() => router.push('/facility/residents/new')}>
          {t('residents_all.add_resident')}
        </Button>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('residents_all.search')}
          placeholderTextColor={colors.mutedForeground}
          style={{
            flex: 1,
            height: 42,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            fontSize: 14,
            color: colors.foreground,
            backgroundColor: colors.surface,
          }}
        />
        <Pressable
          onPress={() => setSortMode(sortMode === 'risk' ? 'room' : 'risk')}
          style={{
            height: 42,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>
            {sortMode === 'risk' ? t('residents_all.sort_risk') : t('residents_all.room')}
          </Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 12 }}>
        {t('residents_all.count_summary', {
          total: sorted.length,
          high: highCount,
          moderate: moderateCount,
          low: lowCount,
        })}
      </Text>
    </>
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={sorted}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={11}
      />
    </View>
  );
}
