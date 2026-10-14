import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { BottomNav, Button, Field, Icon, Logo, Message, palette, Screen, Select, ui } from '@/components/design-system';
import { getPatients, getProfile, Patient, Profile, savePatients } from '@/services/profile-storage';

export default function CaregiverHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', phone: '', gender: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getProfile('caregiver'), getPatients()]).then(([p, list]) => { if (active) { setProfile(p); setPatients(list); } }).catch(() => { if (active) setMessage('โหลดข้อมูลไม่สำเร็จ'); });
    return () => { active = false; };
  }, []));
  const add = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.phone.trim() || !draft.gender) { setMessage('กรุณากรอกข้อมูลให้ครบ'); return; }
    setSaving(true);
    try { const next = [...patients, { ...draft, id: Date.now().toString() }]; await savePatients(next); setPatients(next); setOpen(false); setDraft({ firstName: '', lastName: '', phone: '', gender: '' }); setMessage(''); }
    catch { setMessage('บันทึกรายชื่อไม่สำเร็จ'); } finally { setSaving(false); }
  };
  return <Screen bottom={<BottomNav active="home" caregiver />}>
    <View style={[ui.row, { marginTop: 6, gap: 12 }]}><Logo small /><View style={{ flex: 1, minHeight: 88, borderWidth: 1.5, borderColor: '#252A26', borderRadius: 14, padding: 12, justifyContent: 'center' }}><Text style={{ color: palette.green, fontWeight: '700', textAlign: 'right', marginBottom: 4 }}>ผู้ดูแล</Text><Text style={ui.body}>ชื่อ {profile?.firstName || 'ยังไม่ได้กรอก'}</Text><Text style={ui.body}>นามสกุล {profile?.lastName || 'ยังไม่ได้กรอก'}</Text></View></View>
    <Text style={[ui.section, { marginTop: 20 }]}>ผู้สูงอายุในการดูแล</Text>
    {patients.map((patient) => <TouchableOpacity key={patient.id} onPress={() => router.push({ pathname: '/elderly-home', params: { patient: patient.id } })} style={{ borderWidth: 1, borderLeftWidth: 3, borderColor: palette.green, borderRadius: 14, padding: 13, gap: 16 }}>
      <View style={ui.between}><View style={ui.row}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#E4E7E5', alignItems: 'center', justifyContent: 'center' }}><Icon name="person" color="#202824" size={24} /></View><Text style={ui.body}>{patient.firstName} {patient.lastName}</Text></View><View style={[ui.badge, patient.gender === 'หญิง' && { backgroundColor: '#FAD9F1' }]}><Text style={[ui.badgeText, patient.gender === 'หญิง' && { color: '#A94E95' }]}>{patient.gender}</Text></View></View>
      <View style={ui.between}><View style={ui.row}><Icon name="phone" color="#202824" size={17} /><Text style={ui.body}>{patient.phone}</Text></View><Icon name="chevron" size={18} color="#202824" /></View>
    </TouchableOpacity>)}
    <TouchableOpacity accessibilityLabel="เพิ่มผู้สูงอายุในการดูแล" onPress={() => { setOpen(true); setMessage(''); }} style={{ borderWidth: 1.5, borderColor: '#A3AAB0', borderRadius: 12, minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 }}><Icon name="plus" size={24} color="#8B949C" /></TouchableOpacity>
    {!patients.length && <Text style={[ui.subtitle, { textAlign: 'center' }]}>กด + เพื่อเพิ่มรายชื่อผู้สูงอายุในการดูแล</Text>}
    {!open && <Message text={message} />}
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={ui.modalOverlay}><View style={ui.modal}><Text style={ui.section}>เพิ่มผู้สูงอายุในการดูแล</Text><Field label="ชื่อ" value={draft.firstName} onChangeText={(firstName) => setDraft((old) => ({ ...old, firstName }))} /><Field label="นามสกุล" value={draft.lastName} onChangeText={(lastName) => setDraft((old) => ({ ...old, lastName }))} /><Field label="เบอร์โทรศัพท์" value={draft.phone} keyboardType="phone-pad" onChangeText={(phone) => setDraft((old) => ({ ...old, phone }))} /><Select label="เพศ" value={draft.gender} options={['ชาย', 'หญิง']} onChange={(gender) => setDraft((old) => ({ ...old, gender }))} /><Message text={message} /><Button title="เพิ่มรายชื่อ" onPress={add} loading={saving} /><TouchableOpacity disabled={saving} onPress={() => setOpen(false)}><Text style={ui.link}>ยกเลิก</Text></TouchableOpacity></View></View></Modal>
  </Screen>;
}
