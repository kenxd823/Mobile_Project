import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { BottomNav, Button, Card, Message, Screen, ui } from '@/components/design-system';
import { EnergyCard, NutrientCard, ProfileCard } from '@/components/health-cards';
import { useHealthData } from '@/hooks/use-health-data';
import { getPatients, Patient } from '@/services/profile-storage';
import { profileMetrics } from '@/utils/profile-metrics';

export default function ElderlyHomeScreen() {
  const router = useRouter();
  const { patient: patientId } = useLocalSearchParams<{ patient?: string }>();
  const { profile, totals, goal, error } = useHealthData();
  const metrics = profileMetrics(profile);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientError, setPatientError] = useState('');
  useEffect(() => {
    if (!patientId) return;
    let active = true;
    getPatients().then((patients) => { const found = patients.find((item) => item.id === patientId); if (active) { setPatient(found || null); if (!found) setPatientError('ไม่พบรายชื่อผู้สูงอายุ'); } }).catch(() => { if (active) setPatientError('โหลดข้อมูลผู้สูงอายุไม่สำเร็จ'); });
    return () => { active = false; };
  }, [patientId]);
  return <Screen bottom={patientId ? undefined : <BottomNav active="home" />}>
    <ProfileCard profile={patientId ? patient : profile} />
    {patientId ? <><EnergyCard calories={null} goal={goal} /><View style={ui.tintHeading}><Text style={ui.subtitle}>รายชื่อนี้เก็บไว้ในอุปกรณ์ ยังไม่ได้เชื่อมข้อมูลมื้ออาหารจากบัญชีผู้สูงอายุ</Text></View><Message text={patientError} /><Button title="กลับหน้ารายชื่อ" icon="people" onPress={() => router.replace('/caregiver-home')} /></> : <>
      <Card>
        <View style={ui.between}><Text style={ui.section}>ดัชนีมวลกาย (BMI)</Text><Text style={ui.body}>{metrics.age === null ? 'ยังไม่มีข้อมูลอายุ' : `อายุ ${metrics.age} ปี`}</Text></View>
        <Text style={[ui.section, { fontSize: 26 }]}>{metrics.bmi === null ? 'ไม่มีข้อมูล' : `${metrics.bmi.toFixed(1)} kg/m²`}</Text>
        <Text style={ui.subtitle}>{metrics.bmi === null ? 'กรอกน้ำหนักและส่วนสูงในข้อมูลส่วนตัวเพื่อคำนวณ BMI' : `น้ำหนัก ${profile?.weight} กก. ÷ (ส่วนสูง ${profile?.height} ซม. ÷ 100)²`}</Text>
        <Text style={ui.body}>{metrics.energy === null ? metrics.age !== null && metrics.age < 60 ? 'สูตรพลังงานตามอายุนี้ใช้สำหรับผู้มีอายุ 60 ปีขึ้นไป' : 'กรอกวันเกิดและน้ำหนักเพื่อคำนวณพลังงานรายวัน' : `พลังงานตามสูตรอายุ: ${metrics.factor} × ${metrics.weight} = ${metrics.energy.toLocaleString()} kcal/วัน`}</Text>
        <Text style={ui.subtitle}>{metrics.energy === goal ? 'ใช้ค่าที่คำนวณเป็นเป้าหมายพลังงานรายวัน' : metrics.energy !== null ? `เป้าหมายที่ใช้อยู่ ${goal.toLocaleString()} kcal/วัน · ปรับกลับมาใช้สูตรได้ในตั้งค่า` : `เป้าหมายปัจจุบัน ${goal.toLocaleString()} kcal/วัน ยังไม่ได้คำนวณจากสูตรอายุ`}</Text>
        <Button title="แก้ไขน้ำหนัก ส่วนสูง และวันเกิด" onPress={() => router.push('/elderly-profile')} />
      </Card>
      <EnergyCard calories={totals.calories} goal={goal} /><NutrientCard totals={totals} goal={goal} /><Message text={error} />
    </>}
  </Screen>;
}
