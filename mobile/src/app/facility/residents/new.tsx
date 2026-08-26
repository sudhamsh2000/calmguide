import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import {
  createResident,
  createAssignment,
  getStaffList,
  type StaffDetail,
} from '@/lib/facility-api';
import { getFacilityCode } from '@/lib/facility-storage';

type DiseaseStage = 'early' | 'middle' | 'late' | 'unknown';

function TagInput({
  items,
  onChange,
  placeholder,
  hint,
  colors,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  hint: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const [input, setInput] = useState('');

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInput('');
    }
  };

  return (
    <View>
      <TextInput
        value={input}
        onChangeText={(text) => {
          if (text.endsWith(',')) {
            const trimmed = text.slice(0, -1).trim();
            if (trimmed && !items.includes(trimmed)) {
              onChange([...items, trimmed]);
            }
            setInput('');
          } else {
            setInput(text);
          }
        }}
        onSubmitEditing={addItem}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType="done"
        style={{
          height: 48,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          fontSize: 14,
          color: colors.foreground,
          backgroundColor: colors.surface,
        }}
      />
      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>{hint}</Text>
      {items.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: `${colors.primary}18`,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.foreground }}>{item}</Text>
              <Pressable onPress={() => onChange(items.filter((_, idx) => idx !== i))}>
                <Text style={{ fontSize: 16, color: colors.mutedForeground, fontWeight: '700' }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AddResidentScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const router = useRouter();

  const [stage, setStage] = useState<DiseaseStage>('middle');
  const [unit, setUnit] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [patterns, setPatterns] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<StaffDetail[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ accessCode: string; assignedCount: number } | null>(null);

  useEffect(() => {
    getFacilityCode().then(async (code) => {
      if (!code) return;
      try {
        const list = await getStaffList(code);
        setStaffList(list.filter((s) => s.is_active && s.role === 'staff'));
      } catch { /* silent */ }
    });
  }, []);

  const toggleStaff = (id: string) => {
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const code = await getFacilityCode();
      if (!code) return;
      const result = await createResident(code, {
        disease_stage: stage,
        behavioral_patterns: patterns.length > 0 ? patterns : undefined,
        calming_strategies: strategies.length > 0 ? strategies : undefined,
        safety_concerns: concerns.length > 0 ? concerns : undefined,
        unit: unit.trim() || undefined,
        room: room.trim() || undefined,
        bed: bed.trim() || undefined,
      });

      let assignedCount = 0;
      for (const staffId of selectedStaff) {
        try {
          await createAssignment(code, { staff_id: staffId, profile_id: result.profile_id });
          assignedCount++;
        } catch { /* continue */ }
      }

      setSuccess({ accessCode: result.access_code, assignedCount });
    } catch {
      setError(t('add_resident.error'));
    } finally {
      setSubmitting(false);
    }
  }, [stage, unit, room, bed, patterns, strategies, concerns, selectedStaff, t]);

  const resetForm = () => {
    setStage('middle');
    setUnit('');
    setRoom('');
    setBed('');
    setPatterns([]);
    setStrategies([]);
    setConcerns([]);
    setSelectedStaff([]);
    setSuccess(null);
    setError(null);
  };

  const inputStyle = {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.surface,
  };

  const stageOptions: { value: DiseaseStage; label: string }[] = [
    { value: 'early', label: t('add_resident.stage_early') },
    { value: 'middle', label: t('add_resident.stage_middle') },
    { value: 'late', label: t('add_resident.stage_late') },
    { value: 'unknown', label: t('add_resident.stage_unknown') },
  ];

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: '#E0F0E7',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Text style={{ fontSize: 28, color: '#3A7D5C' }}>✓</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 16 }}>
          {t('add_resident.success_title')}
        </Text>
        <View style={{
          borderWidth: 2, borderColor: `${colors.primary}50`, backgroundColor: `${colors.primary}08`,
          borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, marginBottom: 12, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Access Code</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 4, color: colors.primary }}>
            {success.accessCode}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginBottom: 12, maxWidth: 280 }}>
          {t('add_resident.success_message', { code: success.accessCode })}
        </Text>
        {success.assignedCount > 0 && (
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#16A34A', marginBottom: 16 }}>
            {t('add_resident.assigned_count', { count: success.assignedCount })}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12, width: '100%', maxWidth: 320 }}>
          <Button style={{ flex: 1 }} onPress={resetForm}>{t('add_resident.add_another')}</Button>
          <Button style={{ flex: 1 }} variant="secondary" onPress={() => router.back()}>
            {t('add_resident.view_residents')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 24 }}>
          {t('add_resident.title')}
        </Text>

        {/* Disease Stage */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
          {t('add_resident.disease_stage')} *
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {stageOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={stage === opt.value ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setStage(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </View>

        {/* Location */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
          {t('add_resident.location')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4 }}>{t('add_resident.unit')}</Text>
            <TextInput value={unit} onChangeText={setUnit} placeholder={t('add_resident.unit_placeholder')} placeholderTextColor={colors.mutedForeground} style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4 }}>{t('add_resident.room')}</Text>
            <TextInput value={room} onChangeText={setRoom} placeholder={t('add_resident.room_placeholder')} placeholderTextColor={colors.mutedForeground} style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4 }}>{t('add_resident.bed')}</Text>
            <TextInput value={bed} onChangeText={setBed} placeholder={t('add_resident.bed_placeholder')} placeholderTextColor={colors.mutedForeground} style={inputStyle} />
          </View>
        </View>

        {/* Staff Assignment */}
        {staffList.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 4 }}>
              {t('add_resident.assign_staff')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 10 }}>
              {t('add_resident.assign_hint')}
            </Text>
            {staffList.map((staff) => {
              const checked = selectedStaff.includes(staff.id);
              return (
                <Pressable
                  key={staff.id}
                  onPress={() => toggleStaff(staff.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: checked ? colors.primary : colors.border,
                    backgroundColor: checked ? `${colors.primary}08` : colors.surface,
                    marginBottom: 8,
                  }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 4,
                    borderWidth: 2, borderColor: checked ? colors.primary : colors.border,
                    backgroundColor: checked ? colors.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{staff.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      {staff.assigned_patients_count} {t('add_resident.assign_current')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Behavioral Profile */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 16 }}>
            {t('add_resident.optional_section')}
          </Text>

          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
            {t('add_resident.behavioral_patterns')}
          </Text>
          <TagInput items={patterns} onChange={setPatterns} placeholder={t('add_resident.behavioral_placeholder')} hint={t('add_resident.hint_comma')} colors={colors} />

          <View style={{ height: 16 }} />

          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
            {t('add_resident.calming_strategies')}
          </Text>
          <TagInput items={strategies} onChange={setStrategies} placeholder={t('add_resident.calming_placeholder')} hint={t('add_resident.hint_comma')} colors={colors} />

          <View style={{ height: 16 }} />

          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
            {t('add_resident.safety_concerns')}
          </Text>
          <TagInput items={concerns} onChange={setConcerns} placeholder={t('add_resident.safety_placeholder')} hint={t('add_resident.hint_comma')} colors={colors} />
        </View>

        {error && (
          <Text style={{ fontSize: 13, color: colors.error, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
        )}

        <Button size="lg" onPress={handleSubmit} loading={submitting}>
          {t('add_resident.submit')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
