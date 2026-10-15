import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Button, Icon, Message, Screen, ui } from '@/components/design-system';
import { getPatients, getPersonalProfile, getProfile, Patient, Profile, selectPatient } from '@/services/profile-storage';

export default function SelectElderlyScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [personal, setPersonal] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getPatients(), getPersonalProfile()]).then(([list, own]) => { if (active) { setPatients(list); setPersonal(own); setError(''); } })
      .catch(() => { if (active) setError('โหลดรายชื่อไม่สำเร็จ กรุณาเปิดหน้านี้ใหม่'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  const choose = async (id: string | null) => {
    if (choosing) return;
    setChoosing(true); setError('');
    try {
      await selectPatient(id);
      await AsyncStorage.setItem('userRole', 'elderly');
      // Remove older scanner/profile screens before changing the person in use.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/elderly-home');
    } catch (err) { setError(err instanceof Error ? err.message : 'เลือกรายชื่อไม่สำเร็จ'); }
    finally { setChoosing(false); }
  };
  const addFromCaregiver = async () => {
    setChoosing(true);
    try {
      await AsyncStorage.setItem('userRole', 'caregiver');
      const profile = await getProfile('caregiver');
      router.replace(profile ? '/caregiver-home' : '/caregiver-profile');
    } catch { setError('เปลี่ยนบทบาทไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setChoosing(false); }
  };
  return <Screen>
    <Text style={ui.title}>เลือกรายชื่อผู้สูงอายุ</Text>
    <Text style={ui.subtitle}>กดชื่อของคุณจากรายชื่อที่ผู้ดูแลเพิ่มไว้ในบัญชีนี้</Text>
    {loading ? <ActivityIndicator /> : patients.map(patient => <TouchableOpacity key={patient.id} accessibilityRole="button" disabled={choosing} accessibilityLabel={`เลือก ${patient.firstName} ${patient.lastName}`} onPress={() => choose(patient.id)} style={{ borderWidth: 1, borderColor: '#216440', borderRadius: 16, padding: 18, gap: 8, minHeight: 80 }}>
      <View style={ui.between}><View style={ui.row}><Icon name="person" /><Text style={ui.section}>{patient.firstName} {patient.lastName}</Text></View><Icon name="chevron" /></View>
      <Text style={ui.subtitle}>{patient.gender} · {patient.phone || 'ยังไม่มีเบอร์โทรศัพท์'}</Text>
    </TouchableOpacity>)}
    {!loading && personal && <Button title={`ใช้ข้อมูลเดิม: ${personal.firstName} ${personal.lastName}`} disabled={choosing} onPress={() => choose(null)} />}
    {!loading && !patients.length && <Text style={ui.body}>ยังไม่มีรายชื่อจากผู้ดูแล กรุณาเพิ่มรายชื่อในบทบาทผู้ดูแลก่อน</Text>}
    <Message text={error} />
    {!loading && <Button title="ไปเพิ่มรายชื่อในบทบาทผู้ดูแล" loading={choosing} onPress={addFromCaregiver} />}
    <TouchableOpacity accessibilityRole="button" disabled={choosing} onPress={() => router.replace('/select-role')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={ui.link}>← กลับไปเลือกบทบาท</Text></TouchableOpacity>
  </Screen>;
}
