import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';

interface TopBarProps {
  facilityName: string;
  staffName: string;
  onQuickSwitch?: () => void;
}

export function TopBar({ facilityName, staffName, onQuickSwitch }: TopBarProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleSwitch = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (onQuickSwitch) {
      onQuickSwitch();
    } else {
      router.replace('/facility/login');
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 }}
        >
          CalmGuide
        </Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
          {facilityName}
        </Text>
      </View>

      <Pressable
        onPress={handleSwitch}
        accessibilityRole="button"
        accessibilityLabel="Switch user"
        style={({ pressed }) => ({
          alignItems: 'flex-end',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
          {staffName}
        </Text>
        <Text style={{ fontSize: 12, color: colors.primary }}>Switch</Text>
      </Pressable>
    </View>
  );
}
