import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import {
  createAssignment,
  getAssignments,
  getMyResidents,
  removeAssignment,
  type AssignmentResponse,
  type ResidentCard,
} from '@/lib/facility-api';
import { getFacilityCode } from '@/lib/facility-storage';

export default function AssignPatientsScreen() {
  const { id: staffId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [allResidents, setAllResidents] = useState<ResidentCard[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, 'add' | 'remove'>>(new Map());

  const loadData = useCallback(async () => {
    const code = await getFacilityCode();
    if (!code || !staffId) return;
    try {
      const [residents, existing] = await Promise.all([
        getMyResidents(),
        getAssignments(code, staffId),
      ]);
      setAllResidents(residents);
      setAssignments(existing);
    } catch { /* handled by empty state */ }
    setLoading(false);
  }, [staffId]);

  useEffect(() => { loadData(); }, [loadData]);

  const assignedIds = new Set(assignments.map((a) => a.profile_id));

  const isAssigned = (profileId: string) => {
    const change = pendingChanges.get(profileId);
    if (change === 'add') return true;
    if (change === 'remove') return false;
    return assignedIds.has(profileId);
  };

  const toggleAssignment = (profileId: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const currentlyAssigned = assignedIds.has(profileId);
      const pending = next.get(profileId);

      if (pending) {
        next.delete(profileId);
      } else {
        next.set(profileId, currentlyAssigned ? 'remove' : 'add');
      }
      return next;
    });
  };

  const handleSave = useCallback(async () => {
    const code = await getFacilityCode();
    if (!code || !staffId) return;
    setSaving(true);
    try {
      for (const [profileId, action] of pendingChanges) {
        if (action === 'add') {
          await createAssignment(code, { staff_id: staffId, profile_id: profileId });
        } else {
          const existing = assignments.find((a) => a.profile_id === profileId);
          if (existing) await removeAssignment(code, existing.id);
        }
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save assignments. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, assignments, staffId, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const assignedCount = allResidents.filter((r) => isAssigned(r.profile_id)).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16 }}>
          {t('staff.assigned_count', { count: assignedCount, total: allResidents.length })}
        </Text>

        {allResidents.map((r) => {
          const assigned = isAssigned(r.profile_id);
          return (
            <Pressable
              key={r.profile_id}
              onPress={() => toggleAssignment(r.profile_id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: assigned ? `${colors.primary}15` : colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                borderWidth: 1.5,
                borderColor: assigned ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: assigned ? colors.primary : colors.mutedForeground,
                  backgroundColor: assigned ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginEnd: 12,
                }}
              >
                {assigned && (
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{'✓'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                  Room {r.room ?? '—'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                  {r.disease_stage} stage · {r.risk_level} risk
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {pendingChanges.size > 0 && (
        <View
          style={{
            padding: 16,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Button size="lg" onPress={handleSave} loading={saving}>
            {t('staff.save_assignments')}
          </Button>
        </View>
      )}
    </View>
  );
}
