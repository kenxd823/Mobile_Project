import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CaregiverHomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <View style={styles.profileCircle}>
            <Text style={styles.profileEmoji}>👨‍⚕️</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>สวัสดี,</Text>
            <Text style={styles.nameText}>หมอสมชาย (ผู้ดูแล)</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ผู้สูงอายุในความดูแล</Text>

        {/* รายชื่อผู้สูงอายุ (คนแรก) */}
        <TouchableOpacity style={styles.patientCard}>
          <View style={styles.patientHeader}>
            <View style={styles.patientAvatar}><Text style={{fontSize: 20}}>👵</Text></View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>คุณยาย สมศรี ใจดี</Text>
              <Text style={styles.patientStatus}>ทานไปแล้ว: 1,030 / 1,500 kcal</Text>
            </View>
            <Text style={styles.statusNormal}>ปกติ</Text>
          </View>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '68%' }]} />
          </View>
          
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.viewDetailBtn}>
              <Text style={styles.viewDetailText}>ดูรายละเอียดมื้ออาหาร</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* ปุ่มเพิ่มผู้สูงอายุ */}
        <TouchableOpacity style={styles.addPatientBtn}>
          <Text style={styles.addPatientText}>+ เพิ่มผู้สูงอายุในการดูแล</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F6FF' },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, marginTop: 20 },
  profileCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  profileEmoji: { fontSize: 30 },
  headerTextContainer: { flex: 1 },
  greetingText: { fontSize: 14, color: '#6B7280' },
  nameText: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  
  patientCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  patientHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  patientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  patientStatus: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusNormal: { backgroundColor: '#D1FAE5', color: '#065F46', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, width: '100%', overflow: 'hidden', marginBottom: 15 },
  progressBarFill: { height: '100%', backgroundColor: '#1C6741', borderRadius: 3 },
  
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  viewDetailBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  viewDetailText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  
  addPatientBtn: { backgroundColor: '#E0E7FF', padding: 15, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#818CF8', marginTop: 10 },
  addPatientText: { color: '#4F46E5', fontWeight: 'bold', fontSize: 16 },
});