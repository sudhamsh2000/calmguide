import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from './ThemeContext';

export interface DeflectionResource {
  label: string;
  href: string;
  description?: string;
  phone?: boolean;
}

interface Props {
  title: string;
  subtitle: string;
  body: React.ReactNode;
  resources: DeflectionResource[];
  resourcesHeading?: string;
}

export function DeflectionLayout({ title, subtitle, body, resources, resourcesHeading }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground }}>{title}</Text>
        <Text style={{ fontSize: 15, color: colors.mutedForeground, lineHeight: 22 }}>{subtitle}</Text>
      </View>

      <View style={{ gap: 12 }}>{body}</View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.primary + '33',
          backgroundColor: colors.primary + '0D',
          borderRadius: 16,
          padding: 16,
          gap: 12,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.mutedForeground,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {resourcesHeading ?? 'Trusted resources'}
        </Text>
        {resources.map((r) => (
          <Pressable
            key={r.href}
            onPress={() => Linking.openURL(r.href).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={r.label}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>{r.label}</Text>
            {r.description && (
              <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                {r.description}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
