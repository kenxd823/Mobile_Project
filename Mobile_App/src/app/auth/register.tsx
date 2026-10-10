import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบทุกช่องครับ");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("แจ้งเตือน", "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    
    try {
      // ⚠️ คำเตือน: เปลี่ยน 192.168.1.50 เป็น IPv4 Address จริงของคอมพิวเตอร์คุณที่ได้จากคำสั่ง ipconfig
      const response = await fetch('http://192.168.0.254:8000/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        Alert.alert("สำเร็จ", "ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว");
        // พาไปหน้า OTP พร้อมแนบอีเมลไปด้วย
        router.push({ pathname: '/auth/verify-otp', params: { email } });
      } else {
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      Alert.alert("เชื่อมต่อไม่ได้", "กรุณาตรวจสอบว่าเปิดเซิร์ฟเวอร์ Python ไว้หรือไม่ หรือเช็ค IP Address");
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* โลโก้แอป */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>LOGO</Text>
        </View>

        <Text style={styles.title}>ยินดีต้อนรับ</Text>
        <Text style={styles.subtitle}>สมัครสมาชิก</Text>

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="XXXXXX@XXXXX"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>ยืนยัน-รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>สมัครสมาชิก</Text>
        </TouchableOpacity>

        {/* ปุ่มสลับไปหน้าเข้าสู่ระบบ */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>มีบัญชีใช้อยู่แล้ว? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  logoContainer: { width: 90, height: 90, backgroundColor: '#1C6741', borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  logoText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333333', textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666666', textAlign: 'center', marginBottom: 30 },
  label: { fontSize: 14, color: '#333333', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 16, color: '#333333' },
  registerButton: { backgroundColor: '#1C6741', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  registerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#666666', fontSize: 14 },
  linkText: { color: '#1C6741', fontSize: 14, fontWeight: 'bold' }
});