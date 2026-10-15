import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BottomNav,
  Button,
  Card,
  Field,
  Icon,
  IconName,
  Message,
  palette,
  Progress,
  Screen,
  ui,
} from '@/components/design-system';
import { getProfile, Profile, saveEnergyGoal, userKey } from '@/services/profile-storage';
import { profileMetrics } from '@/utils/profile-metrics';
import { useHealthData } from '@/hooks/use-health-data';
import { useAuth } from '@/hooks/use-auth';
import {
  getReminderPreferences,
  saveReminderPreferences,
  syncMealReminders,
} from '@/services/meal-reminders';

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut, deleteAccount } = useAuth();
  const health = useHealthData();
  const [caregiver, setCaregiver] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState({ meals: false });
  const [reminders, setReminders] = useState({ meals: false, afterMeal: true });
  const [savingReminders, setSavingReminders] = useState(false);
  const energyFormula = profileMetrics(health.profile);
  const [modal, setModal] = useState<
    'goal' | 'privacy' | 'logout' | 'plan' | 'help' | 'delete-account' | null
  >(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [plan, setPlan] = useState('สมดุล');
  const [message, setMessage] = useState('');
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const role = await AsyncStorage.getItem('userRole');
        const [savedProfile, preferences, reminderPrefs] = await Promise.all([
          getProfile(role === 'caregiver' ? 'caregiver' : 'elderly'),
          AsyncStorage.getItem(await userKey('preferences')),
          getReminderPreferences(),
        ]);
        if (active) {
          setCaregiver(role === 'caregiver');
          setProfile(savedProfile);
          setReminders(reminderPrefs);
          if (preferences) {
            const saved = JSON.parse(preferences);
            setPrefs({ meals: !!saved.meals });
            setPlan(saved.plan || 'สมดุล');
          }
        }
      })().catch(() => {
        if (active) setMessage('โหลดการตั้งค่าไม่สำเร็จ');
      });
      return () => {
        active = false;
      };
    }, []),
  );
  const savePrefs = async (next: typeof prefs, nextPlan = plan) => {
    try {
      await AsyncStorage.setItem(
        await userKey('preferences'),
        JSON.stringify({ ...next, plan: nextPlan }),
      );
      setPrefs(next);
      setPlan(nextPlan);
      setMessage('');
    } catch {
      setMessage('บันทึกการตั้งค่าไม่สำเร็จ');
    }
  };
  const saveReminders = async (next: typeof reminders) => {
    if (savingReminders) return;
    setSavingReminders(true);
    setMessage('');
    try {
      await saveReminderPreferences(next);
      setReminders(next);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'ตั้งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSavingReminders(false);
    }
  };
  const saveGoal = async () => {
    const value = Number(goalInput);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('กรุณากรอกพลังงานเป้าหมายมากกว่า 0');
      return;
    }
    try {
      await saveEnergyGoal(value);
      setModal(null);
      setMessage('');
      router.replace('/elderly-home');
    } catch {
      setMessage('บันทึกเป้าหมายไม่สำเร็จ');
    }
  };
  const closeModal = () => {
    if (deleting) return;
    setModal(null);
    setMessage('');
    setDeletePassword('');
    setDeleteConfirmed(false);
  };
  const confirmAccountDeletion = async () => {
    if (deleting) return;
    if (!deleteConfirmed || !deletePassword) {
      setMessage('กรอกรหัสผ่านและยืนยันว่าต้องการลบบัญชี');
      return;
    }
    setDeleting(true);
    setMessage('');
    try {
      await deleteAccount(deletePassword);
      router.replace('/');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'ลบบัญชีไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeletePassword('');
      setDeleting(false);
    }
  };
  const row = (
    icon: IconName,
    title: string,
    detail: string,
    action: () => void,
    trailing?: React.ReactNode,
  ) => (
    <TouchableOpacity onPress={action} style={[ui.row, { minHeight: 48 }]}>
      <View
        style={{
          width: 36,
          height: 36,
          backgroundColor: '#F1F7F2',
          borderRadius: 11,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon name={icon} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ui.body, { fontWeight: '600' }]}>{title}</Text>
        {detail ? (
          <Text style={{ fontSize: 10, color: palette.muted, marginTop: 4 }}>{detail}</Text>
        ) : null}
      </View>
      {trailing || <Icon name="chevron" size={16} color="#8B958F" />}
    </TouchableOpacity>
  );
  return (
    <Screen dense bottom={<BottomNav active="settings" caregiver={caregiver} />}>
      <View style={ui.between}>
        <Text style={ui.title}>ตั้งค่า</Text>
        <TouchableOpacity accessibilityLabel="ช่วยเหลือ" onPress={() => setModal('help')}>
          <Icon name="help" color={palette.ink} />
        </TouchableOpacity>
      </View>
      <Card>
        <View style={ui.row}>
          <View style={[ui.avatar, { width: 48, height: 48, backgroundColor: '#E0EFE5' }]}>
            <Text style={{ color: palette.green, fontWeight: '700' }}>
              {profile?.firstName?.slice(0, 1) || '—'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ui.body, { fontWeight: '700' }]}>
              {profile ? profile.firstName + ' ' + profile.lastName : 'ข้อมูลส่วนตัว'}
            </Text>
            <Text style={{ fontSize: 11, color: palette.muted, marginTop: 5 }}>
              {caregiver ? 'ผู้ดูแล' : 'เป้าหมาย: ดูแลสุขภาพและติดตามมื้ออาหาร'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="แก้ไขข้อมูลส่วนตัว"
            onPress={() => router.push(caregiver ? '/caregiver-profile' : '/elderly-profile')}
          >
            <Icon name="edit" size={20} />
          </TouchableOpacity>
        </View>
      </Card>
      {!caregiver && (
        <View style={{ backgroundColor: '#E0EFE5', borderRadius: 18, padding: 18, gap: 13 }}>
          <View style={ui.between}>
            <View style={ui.row}>
              <Icon name="target" size={18} />
              <Text style={[ui.body, { fontWeight: '700' }]}>เป้าหมายรายวัน</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setGoalInput(String(health.goal));
                setMessage('');
                setModal('goal');
              }}
            >
              <Text style={{ color: palette.green, fontSize: 11 }}>
                {energyFormula.energy !== null ? 'ดูสูตรพลังงาน' : 'ปรับเป้าหมาย'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={ui.between}>
            <Text style={{ color: palette.muted, fontSize: 11 }}>
              พลังงาน {health.goal.toLocaleString()} กิโลแคลอรี่
            </Text>
            <Text style={{ color: palette.green, fontSize: 11 }}>
              ทำได้ {Math.round(((health.totals.calories ?? 0) / health.goal) * 100)}%
            </Text>
          </View>
          <Progress value={((health.totals.calories ?? 0) / health.goal) * 100} />
        </View>
      )}
      <Card compact>
        <Text style={{ color: '#6D7770', fontSize: 11 }}>โภชนาการและการแจ้งเตือน</Text>
        {row(
          'food',
          'แผนโภชนาการ',
          '',
          () => setModal('plan'),
          <View style={ui.row}>
            <Text style={ui.subtitle}>{plan}</Text>
            <Icon name="chevron" size={15} color="#8B958F" />
          </View>,
        )}
        {row(
          'bell',
          'เตือนบันทึกมื้ออาหาร',
          'เช้า 08:00 · กลางวัน 12:00 · เย็น 18:30',
          () => saveReminders({ ...reminders, meals: !reminders.meals }),
          <Switch
            disabled={savingReminders}
            accessibilityLabel="เตือนบันทึกมื้ออาหาร"
            value={reminders.meals}
            onValueChange={(meals) => saveReminders({ ...reminders, meals })}
            trackColor={{ false: '#DDE3DF', true: palette.green }}
            thumbColor="#FFF"
          />,
        )}
        {row(
          'camera',
          'เตือนถ่ายภาพหลังกิน',
          'หลังเริ่มมื้อ 30 และ 60 นาที · หยุดเมื่อบันทึกเสร็จ',
          () => saveReminders({ ...reminders, afterMeal: !reminders.afterMeal }),
          <Switch
            disabled={savingReminders}
            accessibilityLabel="เตือนถ่ายภาพหลังกิน"
            value={reminders.afterMeal}
            onValueChange={(afterMeal) => saveReminders({ ...reminders, afterMeal })}
            trackColor={{ false: '#DDE3DF', true: palette.green }}
            thumbColor="#FFF"
          />,
        )}
        <Text style={{ color: palette.muted, fontSize: 11 }}>
          {Platform.OS === 'web'
            ? 'เว็บมีข้อความเตือนมื้อที่ยังไม่เสร็จในแอป การแจ้งเตือนเมื่อปิดแอปใช้บนมือถือ'
            : 'ตั้งเตือนแยกตามผู้สูงอายุที่เลือก กรุณาอนุญาตแจ้งเตือนในมือถือเพื่อรับการเตือนเมื่อปิดแอป'}
        </Text>
        {Platform.OS !== 'web' && (
          <Button
            title="อนุญาต / ตรวจการแจ้งเตือน"
            disabled={savingReminders}
            onPress={async () => {
              setSavingReminders(true);
              try {
                const result = await syncMealReminders(true);
                setMessage(
                  result.allowed
                    ? 'พร้อมรับการแจ้งเตือนตามที่เปิดไว้'
                    : 'กรุณาเปิดการเตือนด้านบน และอนุญาตการแจ้งเตือนของแอปในตั้งค่ามือถือ',
                );
              } catch {
                setMessage('ตรวจการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่');
              } finally {
                setSavingReminders(false);
              }
            }}
          />
        )}
      </Card>
      <Card compact>
        <Text style={{ color: '#6D7770', fontSize: 11 }}>การเชื่อมต่อและข้อมูล</Text>
        {row('shield', 'ความเป็นส่วนตัว', 'สิทธิ์ข้อมูลและการสำรองข้อมูล', () =>
          setModal('privacy'),
        )}
        <TouchableOpacity onPress={() => setModal('logout')} style={[ui.row, { minHeight: 48 }]}>
          <View style={{ padding: 9, borderRadius: 10, backgroundColor: '#FAEDEB' }}>
            <Icon name="logout" color="#B9483C" size={19} />
          </View>
          <Text style={{ color: '#B9483C', fontSize: 14 }}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </Card>
      <Card compact>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="ลบบัญชี"
          onPress={() => {
            setMessage('');
            setDeletePassword('');
            setDeleteConfirmed(false);
            setModal('delete-account');
          }}
          style={[ui.row, { minHeight: 48 }]}
        >
          <Icon name="logout" color="#B9483C" size={20} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#B9483C', fontSize: 14, fontWeight: '700' }}>ลบบัญชี</Text>
            <Text style={ui.subtitle}>ลบบัญชีและข้อมูลผู้สูงอายุทั้งหมดของบัญชีนี้</Text>
          </View>
        </TouchableOpacity>
      </Card>
      {!modal && <Message text={message || health.error} />}
      <Button
        title={caregiver ? 'สลับบทบาท' : 'เลือกผู้สูงอายุ / สลับบทบาท'}
        icon="people"
        onPress={() => router.push(caregiver ? '/select-role' : '/select-elderly')}
      />
      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={ui.modalOverlay}
        >
          <View style={[ui.modal, { maxHeight: '90%', padding: 0 }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 24, gap: 16 }}
            >
              {modal === 'delete-account' ? (
                <>
                  <Text style={[ui.section, { color: '#B9483C' }]}>ยืนยันลบบัญชีถาวร?</Text>
                  <Text style={ui.body}>{session?.email}</Text>
                  <Text style={ui.subtitle}>
                    บัญชีนี้จะถูกลบจากเซิร์ฟเวอร์ และยกเลิกสถานะเข้าสู่ระบบทุกเครื่อง โปรไฟล์ผู้ดูแล
                    รายชื่อผู้สูงอายุทุกคน ประวัติอาหาร และการตั้งค่าของบัญชีนี้ในเครื่องนี้จะถูกลบ
                    กู้คืนไม่ได้
                  </Text>
                  <Text style={ui.subtitle}>
                    นี่คือการลบทั้งบัญชี ไม่ใช่เฉพาะรายชื่อผู้สูงอายุที่กำลังเลือก
                    ข้อมูลในเครื่องอื่นไม่ได้ถูกล้างจากระยะไกล
                  </Text>
                  <Field
                    label="รหัสผ่านปัจจุบัน"
                    password
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={deletePassword}
                    editable={!deleting}
                    onChangeText={setDeletePassword}
                  />
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel="ฉันยืนยันลบบัญชีนี้ถาวร"
                    accessibilityState={{ checked: deleteConfirmed }}
                    aria-checked={deleteConfirmed}
                    disabled={deleting}
                    onPress={() => setDeleteConfirmed((value) => !value)}
                    style={[ui.row, { minHeight: 48 }]}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderWidth: 1.5,
                        borderColor: '#B9483C',
                        borderRadius: 5,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {deleteConfirmed && <Icon name="check" color="#B9483C" size={18} />}
                    </View>
                    <Text style={[ui.body, { flex: 1 }]}>ฉันยืนยันลบบัญชีนี้ถาวร</Text>
                  </TouchableOpacity>
                  <Message text={message} />
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={deleting || !deleteConfirmed || !deletePassword}
                    onPress={confirmAccountDeletion}
                    style={[
                      ui.button,
                      { backgroundColor: '#B9483C' },
                      (deleting || !deleteConfirmed || !deletePassword) && { opacity: 0.5 },
                    ]}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={ui.buttonText}>ยืนยันลบบัญชีถาวร</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {modal === 'goal' ? (
                    energyFormula.energy !== null ? (
                      <>
                        <Text style={ui.section}>เป้าพลังงานคำนวณอัตโนมัติ</Text>
                        <Text style={ui.body}>
                          อายุ {energyFormula.age} ปี · {energyFormula.factor} ×{' '}
                          {energyFormula.weight} กก. = {energyFormula.energy.toLocaleString()}{' '}
                          kcal/วัน
                        </Text>
                        <Text style={ui.subtitle}>
                          อายุ 60–80 ปีใช้ 25 × น้ำหนัก อายุมากกว่า 80 ปีใช้ 20 × น้ำหนัก
                          เป้าหมายปรับตามวันเกิดและน้ำหนักที่บันทึก
                        </Text>
                        <Button
                          title="แก้ไขวันเกิดและน้ำหนัก"
                          onPress={() => {
                            setModal(null);
                            router.push('/elderly-profile');
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <Field
                          label="พลังงานเป้าหมายต่อวัน (กิโลแคลอรี่)"
                          value={goalInput}
                          onChangeText={setGoalInput}
                          keyboardType="decimal-pad"
                        />
                        <Message text={message} />
                        <Button title="บันทึกเป้าหมาย" onPress={saveGoal} />
                      </>
                    )
                  ) : modal === 'logout' ? (
                    <>
                      <Text style={ui.section}>ออกจากระบบ?</Text>
                      <Text style={ui.subtitle}>ข้อมูลมื้ออาหารยังเก็บไว้ในอุปกรณ์นี้</Text>
                      <Button
                        title="ออกจากระบบ"
                        onPress={async () => {
                          await signOut();
                          router.replace('/');
                        }}
                      />
                    </>
                  ) : modal === 'plan' ? (
                    <>
                      <Text style={ui.section}>แผนโภชนาการ</Text>
                      <Text style={ui.subtitle}>ใช้เป็นป้ายกำกับแผนของคุณ</Text>
                      {['สมดุล', 'แผนตามผู้ดูแล'].map((value) => (
                        <TouchableOpacity
                          key={value}
                          style={ui.option}
                          onPress={async () => {
                            await savePrefs(prefs, value);
                            setModal(null);
                          }}
                        >
                          <Text style={ui.body}>{value}</Text>
                          {plan === value && <Icon name="check" size={18} />}
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    <>
                      <Text style={ui.section}>
                        {modal === 'privacy' ? 'ความเป็นส่วนตัว' : 'การใช้งาน'}
                      </Text>
                      <Text style={ui.subtitle}>
                        {modal === 'privacy'
                          ? 'ข้อมูลส่วนตัว รายชื่อผู้สูงอายุ และมื้ออาหารเก็บในอุปกรณ์นี้ตามบัญชีที่เข้าสู่ระบบ ภาพอาหารส่งไปยังเซิร์ฟเวอร์เพื่อวิเคราะห์ ยังไม่มีการสำรองหรือซิงก์ข้อมูลมื้ออาหารระหว่างอุปกรณ์'
                          : 'เลือกบันทึกอาหารเพื่อถ่ายภาพก่อนกิน จากนั้นปรับเปอร์เซ็นต์อาหารที่เหลือหลังกิน ดูสารอาหารและประวัติได้ที่หน้าแรกและแดชบอร์ด'}
                      </Text>
                    </>
                  )}
                </>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={deleting}
                style={{ paddingVertical: 8 }}
                onPress={closeModal}
              >
                <Text style={ui.link}>
                  {modal === 'goal' || modal === 'logout' || modal === 'delete-account'
                    ? 'ยกเลิก'
                    : 'ปิด'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
