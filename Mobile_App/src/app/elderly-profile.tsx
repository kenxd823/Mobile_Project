import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function ElderlyProfileScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('กรุณาเลือกเพศ'); // ค่าเริ่มต้น
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  // สถานะโรคประจำตัว (Checkbox)
  const [diseases, setDiseases] = useState({
    diabetes: false,      // เบาหวาน
    hypertension: false,  // ความดันโลหิตสูง
    kidney: false,        // ไตเรื้อรัง
    cholesterol: false,   // ไขมันในเลือดสูง
    heart: false,         // หัวใจ
    none: false,          // ไม่มีโรคประจำตัว
  });

  const toggleDisease = (key: keyof typeof diseases) => {
    if (key === 'none') {
      setDiseases({
        diabetes: false,
        hypertension: false,
        kidney: false,
        cholesterol: false,
        heart: false,
        none: !diseases.none,
      });
    } else {
      setDiseases(prev => ({
        ...prev,
        none: false,
        [key]: !prev[key],
      }));
    }
  };

  // ฟังก์ชันกดเลือกเพศ
  const handleSelectGender = () => {
    Alert.alert(
      "เลือกเพศกำเนิด",
      "กรุณาเลือกเพศของคุณ",
      [
        { text: "ชาย", onPress: () => setGender('ชาย') },
        { text: "หญิง", onPress: () => setGender('หญิง') },
        { text: "ยกเลิก", style: "cancel" }
      ]
    );
  };

  const handleSubmit = () => {
    if (!firstName || !lastName || !phone || gender === 'กรุณาเลือกเพศ') {
      Alert.alert("แจ้งเตือน", "กรุณากรอกข้อมูลส่วนตัวและเลือกเพศให้ครบถ้วนครับ");
      return;
    }
    // เมื่อกดตกลงแล้ว พาไปหน้าหลักของผู้สูงอายุ
    router.replace('/elderly-home');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* LOGO ด้านบน */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>LOGO</Text>
        </View>

        <Text style={styles.title}>กรอกข้อมูลส่วนตัว</Text>

        {/* ฟอร์มกรอกข้อมูล */}
        <View style={styles.formContainer}>
          
          <Text style={styles.label}>ชื่อ</Text>
          <TextInput
            style={styles.input}
            placeholder="XXXXXXXXX"
            placeholderTextColor="#9CA3AF"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={styles.label}>นามสกุล</Text>
          <TextInput
            style={styles.input}
            placeholder="XXXXXXXXX"
            placeholderTextColor="#9CA3AF"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.label}>วัน/เดือน/ปี เกิด</Text>
          <TextInput
            style={styles.input}
            placeholder="dd/mm/yy"
            placeholderTextColor="#9CA3AF"
            value={dob}
            onChangeText={setDob}
          />

          <Text style={styles.label}>เบอร์โทรศัพท์</Text>
          <TextInput
            style={styles.input}
            placeholder="XXX-XXXXXXX"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>เพศกำเนิด</Text>
          {/* ช่องเลือกเพศ แบบกดแล้วเด้งเมนูให้เลือก */}
          <TouchableOpacity style={styles.pickerBox} onPress={handleSelectGender}>
            <Text style={[styles.pickerText, gender === 'กรุณาเลือกเพศ' && { color: '#9CA3AF' }]}>
              {gender} ▼
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>น้ำหนัก (กิโลกรัม)</Text>
          <TextInput
            style={styles.input}
            placeholder="XX"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />

          <Text style={styles.label}>ส่วนสูง (เซนติเมตร)</Text>
          <TextInput
            style={styles.input}
            placeholder="XXX"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={height}
            onChangeText={setHeight}
          />

          <Text style={styles.label}>โรคประจำตัว</Text>
          <View style={styles.checkboxGrid}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDisease('diabetes')}>
              <Text style={styles.checkboxIcon}>{diseases.diabetes ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>เบาหวาน</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDisease('hypertension')}>
              <Text style={styles.checkboxIcon}>{diseases.hypertension ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>ความดันโลหิตสูง</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDisease('kidney')}>
              <Text style={styles.checkboxIcon}>{diseases.kidney ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>ไตเรื้อรัง</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDisease('cholesterol')}>
              <Text style={styles.checkboxIcon}>{diseases.cholesterol ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>ไขมันในเลือดสูง</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDisease('heart')}>
              <Text style={styles.checkboxIcon}>{diseases.heart ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>หัวใจ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDisease('none')}>
              <Text style={styles.checkboxIcon}>{diseases.none ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>ไม่มีโรคประจำตัว</Text>
            </TouchableOpacity>
          </View>

          {/* ปุ่มตกลง */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>ตกลง</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingTop: 50, paddingBottom: 40 },
  logoContainer: { width: 100, height: 100, backgroundColor: '#1C6741', borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 25 },
  formContainer: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 16, backgroundColor: '#FFFFFF' },
  pickerBox: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  pickerText: { fontSize: 15, color: '#374151' },
  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  checkboxRow: { width: '48%', flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkboxIcon: { fontSize: 18, color: '#1C6741', marginRight: 8 },
  checkboxLabel: { fontSize: 14, color: '#374151' },
  submitButton: { backgroundColor: '#1C6741', borderRadius: 10, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});