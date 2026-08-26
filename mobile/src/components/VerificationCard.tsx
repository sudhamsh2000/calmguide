import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import { Button } from './Button';
import { verifyIncident } from '../lib/api';
import type { VerificationPending } from '../lib/api';

interface VerificationCardProps {
  accessCode: string;
  pending: VerificationPending;
  onDismiss: () => void;
}

export function VerificationCard({ accessCode, pending, onDismiss }: VerificationCardProps) {
  const { t } = useTranslation('incidents');
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  const handleApprove = useCallback(async () => {
    try {
      await verifyIncident(accessCode, pending.incident_id, { approved: true });
    } catch { /* silent */ }
    setDismissed(true);
    setTimeout(onDismiss, 100);
  }, [accessCode, pending.incident_id, onDismiss]);

  const handleFix = useCallback(async () => {
    try {
      await verifyIncident(accessCode, pending.incident_id, { approved: true, corrections: null });
    } catch { /* silent */ }
    setDismissed(true);
    setTimeout(onDismiss, 100);
  }, [accessCode, pending.incident_id, onDismiss]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setTimeout(onDismiss, 100);
  }, [onDismiss]);

  if (dismissed) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.mutedForeground, marginBottom: 12, textTransform: 'uppercase' }}>
        {t('verification.title')}
      </Text>
      <Text style={{ fontSize: 16, color: colors.foreground, lineHeight: 24, marginBottom: 16 }}>
        &ldquo;{pending.summary_text}&rdquo;
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button variant="primary" size="md" onPress={handleApprove}>
            {t('verification.looks_right')}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="secondary" size="md" onPress={handleFix}>
            {t('verification.let_me_fix')}
          </Button>
        </View>
      </View>
      <Pressable onPress={handleDismiss} accessibilityRole="button" style={{ marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t('verification.dismiss')}</Text>
      </Pressable>
    </View>
  );
}
