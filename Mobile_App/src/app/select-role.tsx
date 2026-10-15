import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Icon, Logo, Message, palette, Screen, ui } from '@/components/design-system';
import { getProfile } from '@/services/profile-storage';
import { useAuth } from '@/hooks/use-auth';

export default function SelectRoleScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [role, setRole] = useState<'caregiver' | 'elderly' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const next = async () => {
    if (!role) return;
    setLoading(true);
    try {
      await AsyncStorage.setItem('userRole', role);
      if (role === 'elderly') { router.replace('/select-elderly'); return; }
      const profile = await getProfile('caregiver');
      router.replace(profile ? '/caregiver-home' : '/caregiver-profile');
    } catch { setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { setLoading(false); }
  };
  return <Screen auth>
    <Logo large /><Text style={ui.authTitle}>เลือกบทบาท</Text>
    <View style={{ flexDirection: 'row', gap: 28, marginTop: 30 }}>
      {(['caregiver', 'elderly'] as const).map((item) => <View key={item} style={{ flex: 1, alignItems: 'center', gap: 12 }}>
        <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: role === item }} aria-checked={role === item} onPress={() => setRole(item)} style={{ width: '100%', minHeight: 176, borderWidth: 2, borderColor: role === item ? palette.green : '#242824', borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: role === item ? '#F2F8F3' : '#FFF' }}>
          <Icon name={item === 'caregiver' ? 'caregiver' : 'people'} size={70} color="#080B09" />
          <Text style={[ui.section, { fontSize: 21 }]}>{item === 'caregiver' ? 'ผู้ดูแล' : 'ผู้สูงอายุ'}</Text>
        </TouchableOpacity>
        <View style={{ width: 22, height: 22, borderWidth: 1, borderColor: role === item ? palette.green : '#555', borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>{role === item && <Icon name="check" size={16} />}</View>
      </View>)}
    </View>
    <Message text={error} /><View style={ui.spacer} />
    <Button title="ตกลง" onPress={next} disabled={!role} loading={loading} />
    <TouchableOpacity style={{ alignSelf: 'center', marginTop: 22, padding: 6 }} onPress={async () => { await signOut(); router.replace('/'); }}><Text style={ui.subtitle}>เปลี่ยนบัญชี</Text></TouchableOpacity>
  </Screen>;
}
