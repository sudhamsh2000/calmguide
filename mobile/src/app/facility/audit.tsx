import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { getAuditLogs, type AuditLogEntry as AuditEntry } from '@/lib/facility-api';
import { useFacilitySessionGuard } from '../../hooks/useFacilitySessionGuard';

const PAGE_SIZE = 50;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatResourceType(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const { recordActivity } = useFacilitySessionGuard();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadAudit = useCallback(async (currentOffset: number) => {
    try {
      const data = await getAuditLogs({ limit: PAGE_SIZE, offset: currentOffset });
      setEntries(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadAudit(offset).finally(() => setLoading(false));
  }, [loadAudit, offset]);

  const handleExportCsv = useCallback(async () => {
    const headers = ['Time', 'User', 'Action', 'Outcome', 'Resource'];
    const rows = entries.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.user_name,
      e.action,
      e.outcome,
      `${e.resource_type}${e.resource_id ? ` (${e.resource_id.slice(0, 8)})` : ''}`,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    await Share.share({ message: csv, title: `audit-log-${new Date().toISOString().slice(0, 10)}.csv` });
  }, [entries]);

  const renderItem = useCallback(({ item: entry }: { item: AuditEntry }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>
          {entry.user_name}
        </Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          {formatTime(entry.timestamp)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: entry.outcome === 'SUCCESS' ? '#DCFCE7' : '#FEE2E2',
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '600',
            color: entry.outcome === 'SUCCESS' ? '#166534' : '#991B1B',
          }}>
            {entry.action}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          {formatResourceType(entry.resource_type)}
        </Text>
      </View>
    </View>
  ), [colors]);

  const keyExtractor = useCallback((item: AuditEntry) => String(item.id), []);

  const listHeader = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground }}>
        {t('audit.title')}
      </Text>
      <Pressable
        onPress={handleExportCsv}
        disabled={entries.length === 0}
        style={({ pressed }) => ({
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: entries.length === 0 ? 0.3 : pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>
          {t('audit.export_csv')}
        </Text>
      </Pressable>
    </View>
  );

  const listEmpty = (
    <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 48 }}>
      {t('audit.no_entries')}
    </Text>
  );

  const listFooter = total > PAGE_SIZE ? (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
        {t('audit.showing', {
          start: offset + 1,
          end: Math.min(offset + PAGE_SIZE, total),
          total,
        })}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: offset === 0 ? 0.3 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 13, color: colors.foreground }}>{t('audit.previous')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setOffset(offset + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= total}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: offset + PAGE_SIZE >= total ? 0.3 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 13, color: colors.foreground }}>{t('audit.next')}</Text>
        </Pressable>
      </View>
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
      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ padding: 16 }}
        onScrollBeginDrag={recordActivity}
        removeClippedSubviews
        initialNumToRender={15}
        windowSize={11}
      />
    </View>
  );
}
