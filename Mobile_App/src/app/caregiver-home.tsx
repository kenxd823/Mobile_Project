import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { BottomNav, Button, Icon, Logo, Message, palette, Screen, ui } from '@/components/design-system';
import { getPatients, getProfile, Patient, Profile } from '@/services/profile-storage';

export default function CaregiverHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getProfile('caregiver'), getPatients()]).then(([p, list]) => { if (active) { setProfile(p); setPatients(list); setMessage(''); } }).catch(() => { if (active) setMessage('โหลดข้อมูลไม่สำเร็จ'); });
    return () => { active = false; };
  }, []));
  return <Screen bottom={<BottomNav active="home" caregiver />}>
    <View style={[ui.row, { marginTop: 6, gap: 12 }]}><Logo small /><View style={{ flex: 1, minHeight: 88, borderWidth: 1.5, borderColor: '#252A26', borderRadius: 14, padding: 12, justifyContent: 'center' }}><Text style={{ color: palette.green, fontWeight: '700', textAlign: 'right', marginBottom: 4 }}>ผู้ดูแล</Text><Text style={ui.body}>ชื่อ {profile?.firstName || 'ยังไม่ได้กรอก'}</Text><Text style={ui.body}>นามสกุล {profile?.lastName || 'ยังไม่ได้กรอก'}</Text></View></View>
    <Text style={[ui.section, { marginTop: 20 }]}>ผู้สูงอายุในการดูแล</Text>
    {patients.map(patient => <View key={patient.id} style={{ borderWidth: 1, borderLeftWidth: 3, borderColor: palette.green, borderRadius: 14, padding: 13 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`ดูข้อมูล ${patient.firstName} ${patient.lastName}`} onPress={() => router.push({ pathname: '/elderly-home', params: { patient: patient.id } })} style={{ gap: 16, paddingVertical: 8 }}>
        <View style={ui.between}><View style={[ui.row, { flex: 1 }]}><Icon name="person" size={24} /><Text style={ui.body}>{patient.firstName} {patient.lastName}</Text></View><View style={[ui.badge, patient.gender === 'หญิง' && { backgroundColor: '#FAD9F1' }]}><Text style={ui.badgeText}>{patient.gender}</Text></View></View>
        <View style={ui.between}><View style={ui.row}><Icon name="phone" size={17} /><Text style={ui.body}>{patient.phone}</Text></View><Icon name="chevron" size={18} /></View>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`แก้ไขข้อมูล ${patient.firstName} ${patient.lastName}`} onPress={() => router.push({ pathname: '/caregiver-patient-profile', params: { patient: patient.id } })} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end' }}><Text style={ui.link}>แก้ไขข้อมูล</Text></TouchableOpacity>
    </View>)}
    <Button title="เพิ่มผู้สูงอายุในการดูแล" icon="plus" onPress={() => router.push('/caregiver-patient-profile')} />
    {!patients.length && <Text style={[ui.subtitle, { textAlign: 'center' }]}>เพิ่มข้อมูลผู้สูงอายุ แล้วเลือกใช้รายชื่อนี้เมื่อสลับเป็นบทบาทผู้สูงอายุ</Text>}
    <Message text={message} />
    <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/select-role')} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={ui.link}>สลับบทบาท</Text></TouchableOpacity>
  </Screen>;
}
