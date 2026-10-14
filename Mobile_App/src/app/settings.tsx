import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Switch, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNav, Button, Card, Field, Icon, IconName, Message, palette, Progress, Screen, ui } from '@/components/design-system';
import { getProfile, Profile, resetEnergyGoal, saveEnergyGoal, userKey } from '@/services/profile-storage';
import { profileMetrics } from '@/utils/profile-metrics';
import { useHealthData } from '@/hooks/use-health-data';
import { useAuth } from '@/hooks/use-auth';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const health = useHealthData();
  const [caregiver, setCaregiver] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState({ meals: false });
  const [modal, setModal] = useState<'goal' | 'privacy' | 'logout' | 'plan' | 'help' | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [plan, setPlan] = useState('สมดุล');
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const role = await AsyncStorage.getItem('userRole');
      const [savedProfile, preferences] = await Promise.all([getProfile(role === 'caregiver' ? 'caregiver' : 'elderly'), AsyncStorage.getItem(await userKey('preferences'))]);
      if (active) { setCaregiver(role === 'caregiver'); setProfile(savedProfile); if (preferences) { const saved = JSON.parse(preferences); setPrefs({ meals: !!saved.meals }); setPlan(saved.plan || 'สมดุล'); } }
    })().catch(() => { if (active) setMessage('โหลดการตั้งค่าไม่สำเร็จ'); });
    return () => { active = false; };
  }, []));
  const savePrefs = async (next: typeof prefs, nextPlan = plan) => {
    try { await AsyncStorage.setItem(await userKey('preferences'), JSON.stringify({ ...next, plan: nextPlan })); setPrefs(next); setPlan(nextPlan); setMessage(''); }
    catch { setMessage('บันทึกการตั้งค่าไม่สำเร็จ'); }
  };
  const saveGoal = async () => {
    const value = Number(goalInput);
    if (!Number.isFinite(value) || value <= 0) { setMessage('กรุณากรอกพลังงานเป้าหมายมากกว่า 0'); return; }
    try { await saveEnergyGoal(value); setModal(null); setMessage(''); router.replace('/elderly-home'); } catch { setMessage('บันทึกเป้าหมายไม่สำเร็จ'); }
  };
  const useCalculatedGoal = async () => {
    try { await resetEnergyGoal(); setModal(null); setMessage(''); router.replace('/elderly-home'); }
    catch { setMessage('เปลี่ยนเป้าหมายไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  };
  const row = (icon: IconName, title: string, detail: string, action: () => void, trailing?: React.ReactNode) => <TouchableOpacity onPress={action} style={[ui.row, { minHeight: 48 }]}><View style={{ width: 36, height: 36, backgroundColor: '#F1F7F2', borderRadius: 11, justifyContent: 'center', alignItems: 'center' }}><Icon name={icon} size={20} /></View><View style={{ flex: 1 }}><Text style={[ui.body, { fontWeight: '600' }]}>{title}</Text>{detail ? <Text style={{ fontSize: 10, color: palette.muted, marginTop: 4 }}>{detail}</Text> : null}</View>{trailing || <Icon name="chevron" size={16} color="#8B958F" />}</TouchableOpacity>;
  return <Screen dense bottom={<BottomNav active="settings" caregiver={caregiver} />}>
    <View style={ui.between}><Text style={ui.title}>ตั้งค่า</Text><TouchableOpacity accessibilityLabel="ช่วยเหลือ" onPress={() => setModal('help')}><Icon name="help" color={palette.ink} /></TouchableOpacity></View>
    <Card><View style={ui.row}><View style={[ui.avatar, { width: 48, height: 48, backgroundColor: '#E0EFE5' }]}><Text style={{ color: palette.green, fontWeight: '700' }}>{profile?.firstName?.slice(0, 1) || '—'}</Text></View><View style={{ flex: 1 }}><Text style={[ui.body, { fontWeight: '700' }]}>{profile ? profile.firstName + ' ' + profile.lastName : 'ข้อมูลส่วนตัว'}</Text><Text style={{ fontSize: 11, color: palette.muted, marginTop: 5 }}>{caregiver ? 'ผู้ดูแล' : 'เป้าหมาย: ดูแลสุขภาพและติดตามมื้ออาหาร'}</Text></View><TouchableOpacity accessibilityLabel="แก้ไขข้อมูลส่วนตัว" onPress={() => router.push(caregiver ? '/caregiver-profile' : '/elderly-profile')}><Icon name="edit" size={20} /></TouchableOpacity></View></Card>
    {!caregiver && <View style={{ backgroundColor: '#E0EFE5', borderRadius: 18, padding: 18, gap: 13 }}><View style={ui.between}><View style={ui.row}><Icon name="target" size={18} /><Text style={[ui.body, { fontWeight: '700' }]}>เป้าหมายรายวัน</Text></View><TouchableOpacity onPress={() => { setGoalInput(String(health.goal)); setMessage(''); setModal('goal'); }}><Text style={{ color: palette.green, fontSize: 11 }}>ปรับเป้าหมาย</Text></TouchableOpacity></View><View style={ui.between}><Text style={{ color: palette.muted, fontSize: 11 }}>พลังงาน {health.goal.toLocaleString()} กิโลแคลอรี่</Text><Text style={{ color: palette.green, fontSize: 11 }}>ทำได้ {Math.round((health.totals.calories ?? 0) / health.goal * 100)}%</Text></View><Progress value={(health.totals.calories ?? 0) / health.goal * 100} /></View>}
    <Card compact><Text style={{ color: '#6D7770', fontSize: 11 }}>โภชนาการและการแจ้งเตือน</Text>
      {row('food', 'แผนโภชนาการ', '', () => setModal('plan'), <View style={ui.row}><Text style={ui.subtitle}>{plan}</Text><Icon name="chevron" size={15} color="#8B958F" /></View>)}
      {row('bell', 'เตือนบันทึกมื้ออาหาร', 'เช้า 08:00 · กลางวัน 12:00 · เย็น 18:30', () => savePrefs({ ...prefs, meals: !prefs.meals }), <Switch accessibilityLabel="เตือนบันทึกมื้ออาหาร" value={prefs.meals} onValueChange={(meals) => savePrefs({ ...prefs, meals })} trackColor={{ false: '#DDE3DF', true: palette.green }} thumbColor="#FFF" />)}
      <Text style={{ color: palette.muted, fontSize: 10 }}>บันทึกความต้องการไว้ก่อน ระบบส่งแจ้งเตือนยังไม่เปิดใช้งาน</Text>
    </Card>
    <Card compact><Text style={{ color: '#6D7770', fontSize: 11 }}>การเชื่อมต่อและข้อมูล</Text>{row('shield', 'ความเป็นส่วนตัว', 'สิทธิ์ข้อมูลและการสำรองข้อมูล', () => setModal('privacy'))}<TouchableOpacity onPress={() => setModal('logout')} style={[ui.row, { minHeight: 48 }]}><View style={{ padding: 9, borderRadius: 10, backgroundColor: '#FAEDEB' }}><Icon name="logout" color="#B9483C" size={19} /></View><Text style={{ color: '#B9483C', fontSize: 14 }}>ออกจากระบบ</Text></TouchableOpacity></Card>
    {!modal && <Message text={message || health.error} />}
    <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}><View style={ui.modalOverlay}><View style={ui.modal}>
      {modal === 'goal' ? <><Field label="พลังงานเป้าหมายต่อวัน (กิโลแคลอรี่)" value={goalInput} onChangeText={setGoalInput} keyboardType="decimal-pad" /><Message text={message} /><Button title="บันทึกเป้าหมาย" onPress={saveGoal} /></> : modal === 'logout' ? <><Text style={ui.section}>ออกจากระบบ?</Text><Text style={ui.subtitle}>ข้อมูลมื้ออาหารยังเก็บไว้ในอุปกรณ์นี้</Text><Button title="ออกจากระบบ" onPress={async () => { await signOut(); router.replace('/'); }} /></> : modal === 'plan' ? <><Text style={ui.section}>แผนโภชนาการ</Text><Text style={ui.subtitle}>ใช้เป็นป้ายกำกับแผนของคุณ</Text>{['สมดุล', 'แผนตามผู้ดูแล'].map((value) => <TouchableOpacity key={value} style={ui.option} onPress={async () => { await savePrefs(prefs, value); setModal(null); }}><Text style={ui.body}>{value}</Text>{plan === value && <Icon name="check" size={18} />}</TouchableOpacity>)}</> : <><Text style={ui.section}>{modal === 'privacy' ? 'ความเป็นส่วนตัว' : 'การใช้งาน'}</Text><Text style={ui.subtitle}>{modal === 'privacy' ? 'ข้อมูลส่วนตัว รายชื่อผู้สูงอายุ และมื้ออาหารเก็บในอุปกรณ์นี้ตามบัญชีที่เข้าสู่ระบบ ภาพอาหารส่งไปยังเซิร์ฟเวอร์เพื่อวิเคราะห์ ยังไม่มีการสำรองหรือซิงก์ข้อมูลมื้ออาหารระหว่างอุปกรณ์' : 'เลือกบันทึกอาหารเพื่อถ่ายภาพก่อนกิน จากนั้นปรับเปอร์เซ็นต์อาหารที่เหลือหลังกิน ดูสารอาหารและประวัติได้ที่หน้าแรกและแดชบอร์ด'}</Text></>}
      {modal === 'goal' && profileMetrics(health.profile).energy !== null && <Button title={`ใช้สูตรตามอายุและน้ำหนัก (${profileMetrics(health.profile).energy?.toLocaleString()} kcal/วัน)`} onPress={useCalculatedGoal} />}
      <TouchableOpacity style={{ paddingVertical: 8 }} onPress={() => { setModal(null); setMessage(''); }}><Text style={ui.link}>{modal === 'goal' || modal === 'logout' ? 'ยกเลิก' : 'ปิด'}</Text></TouchableOpacity>
    </View></View></Modal>
  </Screen>;
}
