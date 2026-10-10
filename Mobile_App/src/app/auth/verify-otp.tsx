import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 🌟 1. นำเข้า AsyncStorage

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // พิมพ์แล้วข้ามไปช่องถัดไปอัตโนมัติ
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');

    if (otpCode.length < 6) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกรหัสยืนยันให้ครบ 6 หลักครับ");
      return;
    }

    try {
      const response = await fetch('http://192.168.0.254:8000/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, otp: otpCode }),
      });

      const data = await response.json();

      if (response.ok) {
        // 🌟 2. บันทึกอีเมลลงในเครื่องก่อนเปลี่ยนหน้า
        await AsyncStorage.setItem('userEmail', email);

        Alert.alert("สำเร็จ", "ยืนยันตัวตนสำเร็จ!", [
          { text: "ตกลง", onPress: () => router.replace('/') }
        ]);
      } else {
        Alert.alert("ข้อผิดพลาด", data.detail || "รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
      }
    } catch (error) {
      Alert.alert("เชื่อมต่อไม่ได้", "กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์ Python หรือ IP Address");
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>LOGO</Text>
          </View>

          <Text style={styles.title}>กรอกรหัสยืนยันจากอีเมล</Text>
          <Text style={styles.subtitle}>เราได้ส่งรหัส 6 หลักไปยัง {email || 'อีเมลของคุณ'} แล้ว</Text>

          {/* ช่องกรอกรหัส 6 ช่อง */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref: TextInput | null) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpBox}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
              />
            ))}
          </View>

          {/* ปุ่มยืนยัน */}
          <TouchableOpacity style={styles.submitButton} onPress={handleVerify}>
            <Text style={styles.submitButtonText}>ยืนยันรหัส OTP</Text>
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>ยังไม่ได้รับอีเมล? </Text>
            <TouchableOpacity onPress={() => Alert.alert("แจ้งเตือน", "กรุณาย้อนกลับไปสมัครสมาชิกใหม่อีกครั้งเพื่อรับรหัส OTP")}>
              <Text style={styles.resendLink}>กดเพื่อส่งรหัสใหม่อีกครั้ง</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAEFF2' },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  logoContainer: { width: 80, height: 80, backgroundColor: '#1C6741', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  logoText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#4B5563', textAlign: 'center', marginBottom: 25 },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  otpBox: { width: 45, height: 50, borderWidth: 1, borderColor: '#9CA3AF', borderRadius: 8, backgroundColor: '#FFFFFF', textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#111827' },
  submitButton: { width: '100%', backgroundColor: '#1C6741', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  resendRow: { flexDirection: 'row' },
  resendText: { color: '#4B5563', fontSize: 14 },
  resendLink: { color: '#1C6741', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' }
});