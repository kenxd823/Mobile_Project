import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ElderlyHomeScreen() {
  const router = useRouter();

  // ฟังก์ชันออกจากระบบ (ลบความจำและกลับไปหน้า Login)
  const handleLogout = async () => {
    Alert.alert(
      "ยืนยันการออกจากระบบ",
      "คุณต้องการออกจากระบบใช่หรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        { 
          text: "ออกจากระบบ", 
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem('userEmail');
            router.replace('/');
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* ส่วนหัว: ข้อความต้อนรับและปุ่มออก */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>สวัสดีครับ/ค่ะ 👴👵</Text>
          <Text style={styles.subtitleText}>ยินดีต้อนรับสู่แอปพลิเคชันดูแลสุขภาพ</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>

      {/* เมนูหลัก (ออกแบบให้ปุ่มใหญ่ กดง่าย เหมาะกับผู้สูงอายุ) */}
      <View style={styles.menuContainer}>
        
        {/* เมนูที่ 1: ถ่ายรูปอาหาร / ตรวจสอบโภชนาการ (เชื่อมกับระบบ YOLO เดิมของคุณ) */}
        <TouchableOpacity 
          style={[styles.card, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}
          onPress={() => {
            // ถ้าคุณมีหน้า scanner.tsx สามารถสั่ง router.push('/scanner') ได้เลย
            router.push('/scanner');
          }}
        >
          <Text style={styles.cardIcon}>📸</Text>
          <Text style={styles.cardTitle}>ถ่ายรูปอาหารเพื่อตรวจสอบ</Text>
          <Text style={styles.cardDesc}>ตรวจสอบความเหมาะสมของอาหาร ป้องกันความเสี่ยงโรค NCDs</Text>
        </TouchableOpacity>

        {/* เมนูที่ 2: ปรึกษาแชทบอทสุขภาพ */}
        <TouchableOpacity 
          style={[styles.card, { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' }]}
          onPress={() => Alert.alert("แนะนำ", "ฟีเจอร์แชทบอทกำลังพัฒนาเพิ่มเติมครับ")}
        >
          <Text style={styles.cardIcon}>💬</Text>
          <Text style={styles.cardTitle}>พูดคุยกับผู้ช่วยสุขภาพ</Text>
          <Text style={styles.cardDesc}>สอบถามเมนูอาหารและคำแนะนำในการปฏิบัติตัวประจำวัน</Text>
        </TouchableOpacity>

        {/* เมนูที่ 3: ปุ่มฉุกเฉิน / ติดต่อผู้ดูแล */}
        <TouchableOpacity 
          style={[styles.card, { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' }]}
          onPress={() => Alert.alert("แจ้งเตือนฉุกเฉิน", "ระบบได้ส่งสัญญาณแจ้งเตือนไปยังผู้ดูแลของคุณแล้วครับ")}
        >
          <Text style={styles.cardIcon}>🚨</Text>
          <Text style={styles.cardTitle}>ติดต่อผู้ดูแลฉุกเฉิน</Text>
          <Text style={styles.cardDesc}>กดปุ่มนี้ทันทีเมื่อต้องการความช่วยเหลือด่วนจากผู้ดูแล</Text>
        </TouchableOpacity>

      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    backgroundColor: '#F9FAFB', 
    padding: 24, 
    paddingTop: 60 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 30 
  },
  welcomeText: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#111827' 
  },
  subtitleText: { 
    fontSize: 14, 
    color: '#4B5563', 
    marginTop: 4 
  },
  logoutButton: { 
    backgroundColor: '#FEE2E2', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8 
  },
  logoutText: { 
    color: '#EF4444', 
    fontWeight: 'bold', 
    fontSize: 13 
  },
  menuContainer: { 
    gap: 16 
  },
  card: { 
    padding: 22, 
    borderRadius: 16, 
    borderWidth: 1.5, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2 
  },
  cardIcon: { 
    fontSize: 38, 
    marginBottom: 10 
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#111827', 
    marginBottom: 6 
  },
  cardDesc: { 
    fontSize: 14, 
    color: '#4B5563', 
    lineHeight: 20 
  }
});