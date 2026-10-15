import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { Button, Field, Icon, Logo, Message, palette, Screen, Select, ui } from './design-system';
import {
  emptyProfile,
  getPatients,
  getProfile,
  Profile,
  savePatient,
  saveProfile,
} from '@/services/profile-storage';
import { ageFromDob } from '@/utils/profile-metrics';

const conditions = [
  'เบาหวาน',
  'ความดันโลหิตสูง',
  'ไตเรื้อรัง',
  'ไขมันในเลือดสูง',
  'หัวใจ',
  'ไม่มีโรคประจำตัว',
];
export default function ProfileForm({
  caregiver = false,
  patient = false,
  patientId,
}: {
  caregiver?: boolean;
  patient?: boolean;
  patientId?: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      if (patient) {
        if (!patientId) return null;
        const found = (await getPatients()).find((item) => item.id === patientId);
        if (!found) throw new Error('ไม่พบรายชื่อผู้สูงอายุ');
        return { ...emptyProfile, ...found };
      }
      return getProfile(caregiver ? 'caregiver' : 'elderly');
    })()
      .then((saved) => {
        if (active && saved) setProfile(saved);
      })
      .catch(() => {
        if (active) {
          setMessage('โหลดข้อมูลเดิมไม่ได้ กรุณาเปิดหน้านี้ใหม่');
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [caregiver, patient, patientId]);
  const set = (key: keyof Profile, value: string) =>
    setProfile((old) => ({ ...old, [key]: value }));
  const toggle = (condition: string) =>
    setProfile((old) => ({
      ...old,
      diseases:
        condition === 'ไม่มีโรคประจำตัว'
          ? old.diseases.includes(condition)
            ? []
            : [condition]
          : old.diseases.includes(condition)
            ? old.diseases.filter((item) => item !== condition)
            : [...old.diseases.filter((item) => item !== 'ไม่มีโรคประจำตัว'), condition],
    }));
  const save = async () => {
    if (loading || restoring || loadFailed) return;
    if (
      !profile.firstName.trim() ||
      !profile.lastName.trim() ||
      !profile.phone.trim() ||
      (caregiver ? !profile.relationship : !profile.gender)
    ) {
      setMessage(
        'กรุณากรอกชื่อ นามสกุล เบอร์โทรศัพท์ และ' + (caregiver ? 'ความสัมพันธ์' : 'เพศกำเนิด'),
      );
      return;
    }
    if (
      !caregiver &&
      [profile.weight, profile.height].some(
        (value) => value && (!Number.isFinite(Number(value)) || Number(value) <= 0),
      )
    ) {
      setMessage('น้ำหนักและส่วนสูงต้องเป็นตัวเลขมากกว่า 0');
      return;
    }
    if (profile.dob.trim() && ageFromDob(profile.dob) === null) {
      setMessage('กรุณากรอกวันเกิดที่ถูกต้องเป็น วัน/เดือน/ปี เช่น 15/06/2500 หรือ 15/06/1957');
      return;
    }
    setLoading(true);
    try {
      if (patient) await savePatient(profile, patientId);
      else await saveProfile(profile, caregiver ? 'caregiver' : 'elderly');
      router.replace(caregiver || patient ? '/caregiver-home' : '/elderly-home');
    } catch {
      setMessage('บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen auth>
      {patient && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace('/caregiver-home')}
          style={{ alignSelf: 'flex-start', paddingVertical: 12 }}
        >
          <Text style={ui.link}>← กลับหน้ารายชื่อ</Text>
        </TouchableOpacity>
      )}
      <Logo />
      <Text style={ui.authTitle}>
        {patient
          ? patientId
            ? 'แก้ไขข้อมูลผู้สูงอายุ'
            : 'เพิ่มผู้สูงอายุในการดูแล'
          : 'กรอกข้อมูลส่วนตัว'}
      </Text>
      <View style={{ marginTop: 30 }}>
        <Field
          label="ชื่อ"
          placeholder="xxxxxxxxx"
          value={profile.firstName}
          onChangeText={(value) => set('firstName', value)}
        />
        <Field
          label="นามสกุล"
          placeholder="xxxxxxxxx"
          value={profile.lastName}
          onChangeText={(value) => set('lastName', value)}
        />
        <Field
          label="วัน/เดือน/ปี เกิด (พ.ศ. หรือ ค.ศ.)"
          placeholder="เช่น 15/06/2500 หรือ 15/06/1957"
          value={profile.dob}
          onChangeText={(value) => set('dob', value)}
        />
        <Field
          label="เบอร์โทรศัพท์"
          placeholder="xxx-xxxxxxx"
          keyboardType="phone-pad"
          value={profile.phone}
          onChangeText={(value) => set('phone', value)}
        />
        {caregiver ? (
          <Select
            label="ความสัมพันธ์กับผู้สูงอายุ"
            value={profile.relationship || ''}
            options={['บุตร/หลาน', 'ญาติ', 'ผู้ดูแลมืออาชีพ/พยาบาล']}
            onChange={(value) => set('relationship', value)}
          />
        ) : (
          <>
            <Select
              label="เพศกำเนิด"
              value={profile.gender}
              options={['ชาย', 'หญิง']}
              onChange={(value) => set('gender', value)}
            />
            <Field
              label="น้ำหนัก (กิโลกรัม)"
              placeholder="xx"
              keyboardType="decimal-pad"
              value={profile.weight}
              onChangeText={(value) => set('weight', value)}
            />
            <Field
              label="ส่วนสูง (เซนติเมตร)"
              placeholder="xxx"
              keyboardType="decimal-pad"
              value={profile.height}
              onChangeText={(value) => set('height', value)}
            />
            <Text style={ui.label}>โรคประจำตัว</Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: 22,
                marginHorizontal: -3,
              }}
            >
              {conditions.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  accessibilityRole="checkbox"
                  accessibilityLabel={condition}
                  accessibilityState={{ checked: profile.diseases.includes(condition) }}
                  aria-checked={profile.diseases.includes(condition)}
                  onPress={() => toggle(condition)}
                  style={{
                    width: '50%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 9,
                    paddingHorizontal: 3,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 1.2,
                      borderColor: profile.diseases.includes(condition) ? palette.green : '#68746D',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {profile.diseases.includes(condition) && <Icon name="check" size={14} />}
                  </View>
                  <Text style={{ fontSize: 13, color: palette.ink, flexShrink: 1 }}>
                    {condition}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <Message text={message} />
      </View>
      <View style={ui.spacer} />
      <Button
        title={patient ? 'บันทึกรายชื่อ' : 'ตกลง'}
        onPress={save}
        loading={loading || restoring}
        disabled={loadFailed}
      />
    </Screen>
  );
}
