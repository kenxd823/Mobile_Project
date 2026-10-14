import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { accountRequest } from '@/services/account-api';
import { useAuth } from '@/hooks/use-auth';
import { Button, Field, Logo, Message, Screen, ui } from '@/components/design-system';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { session, loading: checking, error: sessionError, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (session) router.replace('/select-role');
  }, [router, session]);
  const login = async () => {
    if (!email.trim() || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return; }
    if (loading) return;
    setLoading(true); setError('');
    try { await signIn(await accountRequest('login', { email: email.trim().toLowerCase(), password })); }
    catch (err) { setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { setLoading(false); }
  };
  return <Screen auth>
    <Logo large /><Text style={ui.authTitle}>ยินดีต้อนรับ</Text><Text style={ui.authSubtitle}>เข้าสู่ระบบ</Text>
    <View style={[ui.form, { marginTop: 52 }]}>
      <Field label="อีเมล" placeholder="xxxxxx@xxxxx" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Field label="รหัสผ่าน" placeholder="••••••••" password value={password} onChangeText={setPassword} />
      <TouchableOpacity style={{ alignSelf: 'flex-end', minHeight: 38 }} onPress={() => setError('การรีเซ็ตรหัสผ่านยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ')}><Text style={ui.link}>ลืมรหัสผ่านใช่หรือไม่?</Text></TouchableOpacity>
      <Message text={error || sessionError} />
    </View>
    <View style={ui.spacer} />
    {checking ? <ActivityIndicator /> : <Button title="เข้าสู่ระบบ" onPress={login} loading={loading} />}
    <View style={ui.footer}><Text style={ui.subtitle}>ยังไม่มีบัญชีใช่หรือไม่?</Text><TouchableOpacity onPress={() => router.push('/auth/register')}><Text style={ui.link}>สมัครสมาชิกที่นี่</Text></TouchableOpacity></View>
  </Screen>;
}
