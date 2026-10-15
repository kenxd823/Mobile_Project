import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { BottomNav, Button, Message, Screen, ui } from '@/components/design-system';
import { EnergyCard, NutrientCard, ProfileCard } from '@/components/health-cards';
import { useHealthData } from '@/hooks/use-health-data';
import { profileMetrics } from '@/utils/profile-metrics';
import PendingMealNotice from '@/components/pending-meal-notice';

export default function ElderlyHomeScreen() {
  const router = useRouter();
  const { patient: patientId } = useLocalSearchParams<{ patient?: string }>();
  const { profile, totals, goal, error } = useHealthData(patientId);
  const metrics = profileMetrics(profile);
  return <Screen bottom={patientId ? undefined : <BottomNav active="home" />}>
    <ProfileCard profile={profile} />
    {!patientId && <PendingMealNotice />}
    <EnergyCard calories={totals.calories} goal={goal} />
    <Text style={ui.subtitle}>{metrics.energy !== null ? `เป้าพลังงานตามอายุ ${metrics.age} ปี: ${metrics.factor} × ${metrics.weight} กก. = ${goal.toLocaleString()} kcal/วัน` : 'ยังไม่ใช้สูตรพลังงานผู้สูงอายุ · ตรวจวันเกิดและน้ำหนักได้ในตั้งค่า'}</Text>
    <NutrientCard totals={totals} goal={goal} /><Message text={error} />
    {patientId ? <Button title="กลับหน้ารายชื่อ" icon="people" onPress={() => router.replace('/caregiver-home')} /> : <Button title="เลือกผู้สูงอายุ / สลับบทบาท" icon="people" onPress={() => router.push('/select-elderly')} />}
  </Screen>;
}
