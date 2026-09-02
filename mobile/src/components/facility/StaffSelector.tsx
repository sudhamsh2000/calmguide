import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../ThemeContext';
import type { StaffListItem } from '../../lib/facility-api';

interface StaffSelectorProps {
  staff: StaffListItem[];
  selectedId: string | null;
  onSelect: (staff: StaffListItem) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function StaffSelector({ staff, selectedId, onSelect }: StaffSelectorProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const filtered =
    staff.length >= 10 && query.trim().length > 0
      ? staff.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
      : staff;

  const activeId = selectedId;

  return (
    <View style={{ width: '100%' }}>
      {staff.length >= 10 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 48,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, marginEnd: 8, color: colors.mutedForeground }}>{'🔍'}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find your name…"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            autoCapitalize="words"
            style={{ flex: 1, fontSize: 16, color: colors.foreground }}
            accessibilityLabel="Search staff by name"
          />
        </View>
      )}

      {staff.length >= 10 && query.trim().length > 0 && filtered.length === 0 && (
        <Text
          style={{
            textAlign: 'center',
            fontSize: 14,
            color: colors.mutedForeground,
            paddingVertical: 24,
          }}
        >
          {`No one named '${query.trim()}' found`}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          paddingVertical: 12,
        }}
      >
        {filtered.map((member) => {
          const isActive = member.id === activeId;
          return (
            <Pressable
              key={member.id}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                onSelect(member);
              }}
              accessibilityRole="button"
              accessibilityLabel={member.name}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => ({
                alignItems: 'center',
                justifyContent: 'center',
                width: 100,
                paddingVertical: 12,
                paddingHorizontal: 4,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: isActive
                  ? colors.primary + '15'
                  : pressed
                    ? colors.foreground + '08'
                    : 'transparent',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.primary,
                  opacity: isActive ? 1 : 0.85,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                  {getInitials(member.name)}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isActive ? colors.primary : colors.foreground,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {member.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
