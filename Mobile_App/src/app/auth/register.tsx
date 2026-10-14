import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Button, Field, Logo, Message, Screen, ui } from '@/components/design-system';
import { accountRequest } from '@/services/account-api';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = async () => {
    if (!email.trim() || !password || !confirm) { setError('กรุณากรอกข้อมูลให้ครบทุกช่อง'); return; }
    if (password !== confirm) { setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน'); return; }
    if (password.length < 8 || password.length > 128) { setError('รหัสผ่านต้องมีความยาว 8–128 ตัวอักษร'); return; }
    setLoading(true); setError('');
    try {
      await accountRequest('send-otp', { email: email.trim().toLowerCase(), password });
      router.push({ pathname: '/auth/verify-otp', params: { email: email.trim().toLowerCase() } });
    } catch (err) { setError(err instanceof TypeError ? 'เชื่อมต่อเซิร์ฟเวอร์สมัครสมาชิกไม่ได้ กรุณาเปิดเซิร์ฟเวอร์บัญชีผู้ใช้ที่พอร์ต 8000 แล้วลองใหม่' : err instanceof Error ? err.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setLoading(false); }
  };
  return <Screen auth>
    <Logo large /><Text style={ui.authTitle}>ยินดีต้อนรับ</Text><Text style={ui.authSubtitle}>สมัครสมาชิก</Text>
    <View style={ui.form}>
      <Field label="อีเมล" placeholder="xxxxxx@xxxxx" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Field label="รหัสผ่าน" placeholder="••••••••" password value={password} onChangeText={setPassword} />
      <Field label="ยืนยัน-รหัสผ่าน" placeholder="••••••••" password value={confirm} onChangeText={setConfirm} />
      <Message text={error} />
    </View>
    <View style={ui.spacer} /><Button title="สมัครสมาชิก" onPress={register} loading={loading} />
    <View style={ui.footer}><Text style={ui.subtitle}>มีบัญชีใช้อยู่แล้ว?</Text><TouchableOpacity onPress={() => router.replace('/')}><Text style={ui.link}>เข้าสู่ระบบ</Text></TouchableOpacity></View>
  </Screen>;
}
