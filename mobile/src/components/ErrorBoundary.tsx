import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmergencyBar } from './EmergencyBar';
import { useTheme } from './ThemeContext';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

function ErrorFallback({ onRestart }: { onRestart: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EmergencyBar />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 12 }}>
          {t('error_boundary.title')}
        </Text>
        <Text style={{ fontSize: 16, color: colors.mutedForeground, textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>
          {t('error_boundary.message')}
        </Text>
        <Pressable
          style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, minHeight: 48 }}
          onPress={onRestart}
          accessibilityRole="button"
          accessibilityLabel={t('error_boundary.retry')}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{t('error_boundary.retry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  private handleRestart = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRestart={this.handleRestart} />;
    }
    return this.props.children;
  }
}
