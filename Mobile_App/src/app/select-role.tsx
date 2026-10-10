import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SelectRoleScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleNext = () => {
    if (selectedRole === 'caregiver') {
      router.push('/caregiver-home'); // ลบ // ออก
    } else if (selectedRole === 'elderly') {
      router.push('/elderly-home'); // ลบ // ออก
    } else {
      alert('กรุณาเลือกบทบาทก่อนครับ');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>LOGO</Text>
      </View>

      <Text style={styles.title}>เลือกบทบาท</Text>

      <View style={styles.roleContainer}>
        {/* ปุ่มเลือก ผู้ดูแล */}
        <TouchableOpacity 
          style={[styles.roleCard, selectedRole === 'caregiver' && styles.roleCardActive]} 
          onPress={() => setSelectedRole('caregiver')}
        >
          <Text style={styles.iconText}>👨‍⚕️</Text>
          <Text style={styles.roleTitle}>ผู้ดูแล</Text>
          <View style={[styles.radioCircle, selectedRole === 'caregiver' && styles.radioActive]} />
        </TouchableOpacity>

        {/* ปุ่มเลือก ผู้สูงอายุ */}
        <TouchableOpacity 
          style={[styles.roleCard, selectedRole === 'elderly' && styles.roleCardActive]} 
          onPress={() => setSelectedRole('elderly')}
        >
          <Text style={styles.iconText}>👵</Text>
          <Text style={styles.roleTitle}>ผู้สูงอายุ</Text>
          <View style={[styles.radioCircle, selectedRole === 'elderly' && styles.radioActive]} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.nextButton, !selectedRole && styles.nextButtonDisabled]} 
        onPress={handleNext}
        disabled={!selectedRole}
      >
        <Text style={styles.nextButtonText}>ตกลง</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' },
  logoContainer: { width: 100, height: 100, backgroundColor: '#1C6741', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333333', marginBottom: 40 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 60 },
  roleCard: { width: '45%', aspectRatio: 0.8, borderWidth: 2, borderColor: '#E0E0E0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 15 },
  roleCardActive: { borderColor: '#1C6741', backgroundColor: '#F0F7F3' },
  iconText: { fontSize: 50, marginBottom: 15 },
  roleTitle: { fontSize: 18, fontWeight: 'bold', color: '#333333', marginBottom: 15 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CCCCCC' },
  radioActive: { borderColor: '#1C6741', backgroundColor: '#1C6741' },
  nextButton: { width: '100%', backgroundColor: '#1C6741', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  nextButtonDisabled: { backgroundColor: '#A5C9B4' },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});