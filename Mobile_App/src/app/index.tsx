import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 🌟 1. นำเข้า AsyncStorage

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'login' | 'role'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true); // 🌟 2. เพิ่ม State สำหรับสถานะกำลังตรวจสอบ

  // 🌟 3. ให้แอปเช็คความจำทันทีที่เปิดหน้านี้ขึ้นมา
  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('userEmail');
      if (savedEmail) {
        // ถ้าเคยล็อกอินไว้ ให้ข้ามไปหน้าเลือกบทบาทเลย
        setStep('role');
      }
    } catch (error) {
      console.log("Error checking login status:", error);
    } finally {
      // เช็คเสร็จแล้ว ปิดที่โหลดหมุนๆ
      setIsChecking(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    
    // 🌟 4. บันทึกอีเมลลงเครื่องตอนกดเข้าสู่ระบบปกติด้วย
    try {
      await AsyncStorage.setItem('userEmail', email);
    } catch (error) {
      console.log("Error saving login:", error);
    }

    // เปลี่ยนไปหน้าเลือกบทบาททันทีเมื่อกด
    setStep('role');
  };

  const handleSelectRoleNext = () => {
    if (!selectedRole) {
      Alert.alert("แจ้งเตือน", "กรุณาเลือกบทบาทก่อนครับ");
      return;
    }
    if (selectedRole === 'caregiver') {
      router.push('/caregiver-home'); // ไปหน้าผู้ดูแล
    } else if (selectedRole === 'elderly') {
      router.push('/elderly-profile'); // 🌟 เปลี่ยนให้วิ่งมาหน้ากรอกข้อมูลส่วนตัวนี้
    }
  };

  // 🌟 5. แสดงหน้าจอโหลดระหว่างที่แอปกำลังค้นหาข้อมูลในเครื่อง
  if (isChecking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1C6741" />
      </View>
    );
  }

  // หากอยู่ขั้นตอนเลือกบทบาท
  if (step === 'role') {
    return (
      <View style={styles.containerRole}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>LOGO</Text>
        </View>
        <Text style={styles.title}>เลือกบทบาท</Text>

        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={[styles.roleCard, selectedRole === 'caregiver' && styles.roleCardActive]} 
            onPress={() => setSelectedRole('caregiver')}
          >
            <Text style={styles.iconText}>👨‍⚕️</Text>
            <Text style={styles.roleTitle}>ผู้ดูแล</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.roleCard, selectedRole === 'elderly' && styles.roleCardActive]} 
            onPress={() => setSelectedRole('elderly')}
          >
            <Text style={styles.iconText}>👵</Text>
            <Text style={styles.roleTitle}>ผู้สูงอายุ</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.nextButton, !selectedRole && styles.nextButtonDisabled]} 
          onPress={handleSelectRoleNext}
        >
          <Text style={styles.nextButtonText}>ตกลง</Text>
        </TouchableOpacity>

        {/* 🌟 เพิ่มปุ่มออกจากระบบ เพื่อลบความจำในเครื่อง */}
        <TouchableOpacity 
          style={{marginTop: 20}} 
          onPress={async () => {
            await AsyncStorage.removeItem('userEmail');
            setStep('login');
          }}
        >
          <Text style={{color: '#d32f2f', fontSize: 14}}>← ออกจากระบบ (เปลี่ยนบัญชี)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // หน้า Login ปกติ
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>LOGO</Text>
        </View>

        <Text style={styles.title}>ยินดีต้อนรับ</Text>
        <Text style={styles.subtitle}>เข้าสู่ระบบ</Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>อีเมล</Text>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>รหัสผ่าน</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
          </TouchableOpacity>

          {/* ปุ่มไปหน้าสมัครสมาชิก */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>ยังไม่มีบัญชีใช่หรือไม่? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.registerLink}>สมัครสมาชิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  containerRole: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' },
  logoContainer: { width: 100, height: 100, backgroundColor: '#1C6741', borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333333', textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666666', textAlign: 'center', marginBottom: 40 },
  formContainer: { width: '100%' },
  label: { fontSize: 14, color: '#333333', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 16, color: '#333333' },
  loginButton: { backgroundColor: '#1C6741', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerText: { color: '#666666', fontSize: 14 },
  registerLink: { color: '#1C6741', fontSize: 14, fontWeight: 'bold' },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 40, marginTop: 20 },
  roleCard: { width: '45%', aspectRatio: 0.9, borderWidth: 2, borderColor: '#E0E0E0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 15 },
  roleCardActive: { borderColor: '#1C6741', backgroundColor: '#F0F7F3' },
  iconText: { fontSize: 40, marginBottom: 10 },
  roleTitle: { fontSize: 16, fontWeight: 'bold', color: '#333333' },
  nextButton: { width: '100%', backgroundColor: '#1C6741', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  nextButtonDisabled: { backgroundColor: '#A5C9B4' },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});