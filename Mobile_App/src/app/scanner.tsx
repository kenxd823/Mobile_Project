import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<any>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>เราต้องการสิทธิ์ในการเข้าถึงกล้องเพื่อถ่ายรูปอาหาร</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>ให้สิทธิ์เข้าถึงกล้อง</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ฟังก์ชันถ่ายรูปและส่งไปที่ Python API
  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);
      
      // 1. ถ่ายภาพจากกล้อง
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      
      // 2. เตรียมข้อมูล FormData (แก้ปัญหา FormDataPart ด้วยการใช้ unknown as Blob)
      const formData = new FormData();
      formData.append('image', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'food.jpg',
      } as unknown as Blob);

      // 3. ส่ง POST Request ไปที่ Python (เอา headers 'Content-Type' ออก เพื่อให้ระบบจัดการ Boundary ให้)
      const response = await fetch('http://192.168.0.254:5000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        Alert.alert(
          "ผลการวิเคราะห์โภชนาการ",
          `เมนู: ${data.menu}\nพลังงาน: ${data.nutrition.calories} kcal\nโปรตีน: ${data.nutrition.protein} g\nคาร์บ: ${data.nutrition.carbs} g`,
          [{ text: "ตกลง", onPress: () => router.back() }]
        );
      } else if (data.status === 'empty') {
        Alert.alert("แจ้งเตือน", data.message);
      } else {
        Alert.alert("ข้อผิดพลาด", data.message || "ไม่สามารถวิเคราะห์ภาพได้");
      }

    } catch (error) {
      console.error(error);
      Alert.alert("เชื่อมต่อไม่ได้", "กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์ Python หรือ IP Address");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />

      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← กลับ</Text>
        </TouchableOpacity>

        <View style={styles.scanBox}>
          <Text style={styles.scanText}>วางอาหารและช้อนให้อยู่ในกรอบ</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.captureButton} 
            onPress={handleCapture}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="large" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, width: '100%', height: '100%' },
  overlay: { 
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20 
  },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  message: { textAlign: 'center', marginBottom: 20, fontSize: 16, color: '#333' },
  button: { backgroundColor: '#1C6741', padding: 12, borderRadius: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  backButton: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  backButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  scanBox: { 
    width: '100%', 
    height: 280, 
    borderWidth: 2, 
    borderColor: '#10B981', 
    borderStyle: 'dashed', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.15)' 
  },
  scanText: { 
    color: '#FFF', 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    fontSize: 14, 
    overflow: 'hidden' 
  },
  footer: { width: '100%', alignItems: 'center' },
  captureButton: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 4, 
    borderColor: '#FFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.3)' 
  },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },
});