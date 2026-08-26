import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { IncidentLogger } from '../../components/IncidentLogger';
import { ResidentContextBanner } from '../../components/facility/ResidentContextBanner';

export default function NewIncidentScreen() {
  const { t } = useTranslation('incidents');
  const { profile_id, unit, room, bed, risk } = useLocalSearchParams<{
    profile_id?: string;
    unit?: string;
    room?: string;
    bed?: string;
    risk?: string;
  }>();

  const isFacilityMode = !!profile_id;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('logger.title'), headerBackTitle: '' }} />
      {isFacilityMode && (
        <ResidentContextBanner
          unit={unit ?? null}
          room={room ?? null}
          bed={bed ?? null}
          riskLevel={(risk as 'high' | 'moderate' | 'low') ?? 'low'}
        />
      )}
      <IncidentLogger profileId={profile_id} />
    </View>
  );
}
