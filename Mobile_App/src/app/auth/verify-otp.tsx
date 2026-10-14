import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { accountRequest } from '@/services/account-api';
import { useAuth } from '@/hooks/use-auth';
import { Button, Logo, Message, Screen, ui, palette } from '@/components/design-system';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const refs = useRef<(TextInput | null)[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const change = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '').slice(0, 6 - index).split('');
    setOtp((previous) => { const next = [...previous]; next[index] = ''; digits.forEach((digit, n) => { next[index + n] = digit; }); return next; });
    if (digits.length && index + digits.length < 6) refs.current[index + digits.length]?.focus();
  };
  const submit = async (resend = false) => {
    if (!resend && otp.join('').length !== 6) { setMessage('กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก'); return; }
    if (!email) { setMessage('ไม่พบอีเมล กรุณากลับไปหน้าสมัครสมาชิก'); return; }
    setLoading(true); setMessage('');
    try {
      const data = await accountRequest(resend ? 'send-otp' : 'verify-otp', resend ? { email } : { email, otp: otp.join('') });
      if (resend) { setOtp(['', '', '', '', '', '']); setMessage('ส่งรหัสใหม่ไปยังอีเมลแล้ว'); refs.current[0]?.focus(); }
      else { await signIn(data); router.replace('/select-role'); }
    } catch (err) { setMessage(err instanceof TypeError ? 'เชื่อมต่อเซิร์ฟเวอร์บัญชีผู้ใช้ไม่ได้ กรุณาเปิดเซิร์ฟเวอร์ที่พอร์ต 8000 แล้วลองใหม่' : err instanceof Error ? err.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); } finally { setLoading(false); }
  };
  return <Screen auth>
    <View style={{ flex: 1, backgroundColor: '#DCE1E3', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, borderRadius: 28, marginHorizontal: -16, marginTop: -16 }}>
      <Logo large /><Text style={[ui.authTitle, { fontSize: 22, marginTop: 12 }]}>กรอกรหัสยืนยันจากอีเมล</Text>
      <Text style={[ui.authSubtitle, { fontSize: 12, lineHeight: 20 }]}>เราได้ส่งรหัส 6 หลักไปยัง {email || 'อีเมลของคุณ'} แล้ว</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 44, marginBottom: 14 }}>
        {otp.map((digit, index) => <TextInput key={index} ref={(ref) => { refs.current[index] = ref; }} accessibilityLabel={'รหัสหลักที่ ' + (index + 1)} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" value={digit} onChangeText={(text) => change(text, index)} onKeyPress={(event) => { if (event.nativeEvent.key === 'Backspace' && !digit && index > 0) refs.current[index - 1]?.focus(); }} style={{ flex: 1, minWidth: 0, height: 58, borderWidth: 1, borderColor: '#ADB5BD', backgroundColor: '#FFF', textAlign: 'center', fontSize: 24, color: palette.ink }} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 }}><Text style={ui.subtitle}>ยังไม่ได้รับอีเมล?</Text><TouchableOpacity disabled={loading} onPress={() => submit(true)}><Text style={ui.link}>กดเพื่อส่งรหัสใหม่อีกครั้ง</Text></TouchableOpacity></View>
      <Message text={message} /><View style={ui.spacer} /><Button title="ส่ง" onPress={() => submit()} loading={loading} />
    </View>
  </Screen>;
}
