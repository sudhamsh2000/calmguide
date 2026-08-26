import React, { useEffect, useState } from 'react';
import { I18nManager, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeContext';
import {
  getProfiles,
  getActiveProfileIndex,
  switchProfile,
  type StoredProfile,
} from '../lib/storage';

interface ProfileSwitcherProps {
  onSwitch: () => void;
}

export function ProfileSwitcher({ onSwitch }: ProfileSwitcherProps) {
  const { colors } = useTheme();
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getProfiles();
      const idx = await getActiveProfileIndex();
      setProfiles(p);
      setActiveIndex(idx);
    })();
  }, []);

  if (profiles.length <= 1) return null;

  const active = profiles[activeIndex];

  return (
    <View style={{ position: 'relative', zIndex: 10 }}>
      <Pressable
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 44,
        }}
        accessibilityRole="button"
        accessibilityLabel={`Active profile: ${active?.patient_name ?? 'Unknown'}`}
        accessibilityState={{ expanded: open }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
            {active?.patient_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }} numberOfLines={1}>
            {active?.patient_name ?? 'Unknown'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'capitalize' }}>
            {active?.disease_stage ?? ''} stage
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {open && (
        <View style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginTop: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 5,
        }}>
          {profiles.map((profile, index) => (
            <Pressable
              key={profile.access_code}
              onPress={async () => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                await switchProfile(index);
                setActiveIndex(index);
                setOpen(false);
                onSwitch();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                minHeight: 44,
                backgroundColor: index === activeIndex ? `${colors.primary}08` : 'transparent',
              }}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: index === activeIndex }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                  {profile.patient_name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }} numberOfLines={1}>
                  {profile.patient_name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'capitalize' }}>
                  {profile.disease_stage} stage
                </Text>
              </View>
              {index === activeIndex && (
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '700' }}>{'✓'}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
