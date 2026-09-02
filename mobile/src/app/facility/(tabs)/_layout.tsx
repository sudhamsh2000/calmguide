import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/components/ThemeContext';
import { getStoredStaff, type StoredStaff } from '@/lib/facility-storage';

function PeopleIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </Svg>
  );
}

function ChartIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    </Svg>
  );
}

export default function FacilityTabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const [staff, setStaff] = useState<StoredStaff | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getStoredStaff().then(setStaff);
  }, []);

  const isAdmin = staff?.role === 'admin' || staff?.role === 'owner';
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: isAdmin
          ? {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: tabBarHeight,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 4,
            }
          : { display: 'none' },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.foreground, fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="residents"
        options={{
          title: t('nav.my_residents'),
          tabBarLabel: t('nav.my_residents'),
          headerShown: false,
          tabBarIcon: ({ color }) => <PeopleIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('nav.dashboard'),
          tabBarLabel: t('nav.dashboard'),
          headerShown: false,
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <ChartIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
