import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BottomNav, Button, Card, Field, Icon, IconName, Message, palette, Screen, ui } from '@/components/design-system';
import { dayKey, useHealthData } from '@/hooks/use-health-data';
import { CompletedMeal, deleteTodayMeal, restoreDeletedMeal } from '@/services/meal-storage';
import { formatNutrient, DISPLAY_NUTRIENTS } from '@/utils/nutrition';
import PendingMealNotice from '@/components/pending-meal-notice';

export default function FoodLogScreen() {
  const router = useRouter();
  const { history, error, refreshHistory } = useHealthData();
  const [date, setDate] = useState(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [dateError, setDateError] = useState('');
  const [detail, setDetail] = useState<CompletedMeal | null>(null);
  const [changing, setChanging] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const openDetail = (meal: CompletedMeal) => { setActionError(''); setDetail(meal); };
  const closeDetail = () => { if (!changing) { setDetail(null); setActionError(''); } };
  const removeMeal = async () => {
    if (!detail || changing) return;
    setChanging(true); setActionError('');
    try {
      await deleteTodayMeal(detail.id);
      setDeletedId(detail.id);
      setDetail(null);
      await refreshHistory();
    } catch (err) { setActionError(err instanceof Error ? err.message : 'ลบมื้ออาหารไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setChanging(false); }
  };
  const undoDelete = async () => {
    if (!deletedId || changing) return;
    setChanging(true); setActionError('');
    try { await restoreDeletedMeal(deletedId); setDeletedId(null); await refreshHistory(); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'คืนค่ามื้ออาหารไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setChanging(false); }
  };
  const meals = history.filter((meal) => dayKey(new Date(meal.completedAt)) === dayKey(date));
  const slots: { title: string; icon: IconName; color: string; matches: (hour: number) => boolean }[] = [
    { title: 'มื้อเช้า', icon: 'breakfast', color: '#BD9054', matches: (h) => h < 11 },
    { title: 'มื้อกลางวัน', icon: 'sun', color: palette.green, matches: (h) => h >= 11 && h < 16 },
    { title: 'มื้อเย็น', icon: 'moon', color: palette.green, matches: (h) => h >= 16 },
  ];
  const chooseDate = () => {
    const [day, month, year] = dateInput.split('/').map(Number);
    const next = new Date(year, month - 1, day);
    if (!year || next.getDate() !== day || next.getMonth() !== month - 1 || next.getFullYear() !== year) { setDateError('กรอกวันที่ในรูปแบบ วัน/เดือน/ปี ค.ศ.'); return; }
    setDate(next); setDateOpen(false); setDateError('');
  };
  return <Screen bottom={<BottomNav active="food" />}>
    <PendingMealNotice />
    <View style={ui.between}><View><Text style={ui.title}>บันทึกอาหาร</Text><Text style={ui.subtitle}>ติดตามมื้ออาหารและสารอาหาร</Text></View><TouchableOpacity onPress={() => { setDateInput(date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear()); setDateOpen(true); }} style={{ backgroundColor: '#F0F7F1', padding: 10, borderRadius: 18 }}><Text style={{ color: palette.green, fontSize: 11 }}>{date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</Text></TouchableOpacity></View>
    <View style={[ui.between, { marginTop: 18 }]}><Text style={ui.section}>{dayKey(date) === dayKey(new Date()) ? 'มื้ออาหารวันนี้' : 'มื้ออาหารที่บันทึก'}</Text><Text style={{ color: palette.green, fontSize: 12 }}>{meals.length} มื้อ</Text></View>
    {!!deletedId && <Card compact><Text style={ui.body}>ลบมื้ออาหารแล้ว</Text><TouchableOpacity accessibilityRole="button" disabled={changing} onPress={undoDelete} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={ui.link}>{changing ? 'กำลังอัปเดต…' : 'เลิกทำการลบ'}</Text></TouchableOpacity></Card>}
    {slots.map((slot) => {
      const entries = meals.filter((meal) => slot.matches(new Date(meal.createdAt).getHours()));
      return <TouchableOpacity key={slot.title} onPress={() => entries.length ? openDetail(entries[0]) : router.push('/scanner')} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 18, gap: 14, boxShadow: '0px 4px 10px rgba(25, 50, 34, 0.04)' }}>
        <View style={ui.row}><View style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: slot.icon === 'breakfast' ? '#FBF6EF' : '#F0F7F2' }}><Icon name={slot.icon} color={slot.color} size={24} /></View><View style={{ flex: 1, gap: 4 }}><View style={[ui.row, { gap: 8 }]}><Text style={ui.body}>{slot.title}</Text><Text style={{ color: palette.muted, fontSize: 11 }}>{entries.length ? entries.length + ' รายการ' : 'ยังไม่ได้บันทึก'}</Text></View><Text style={ui.subtitle}>{entries.length ? entries[0].menu : 'เพิ่มรายการอาหารสำหรับมื้อนี้'}</Text></View><Icon name="chevron" size={18} color="#929C96" /></View>
        {entries.map((meal, index) => <TouchableOpacity key={meal.id} onPress={() => openDetail(meal)} style={[ui.between, { borderTopWidth: 1, borderColor: palette.line, paddingTop: 10 }]}><Text style={[ui.subtitle, { flex: 1 }]}>{index + 1}. {meal.menu}</Text><Text style={{ color: palette.green, fontSize: 12 }}>{formatNutrient(meal.eaten.calories)} kcal</Text></TouchableOpacity>)}
      </TouchableOpacity>;
    })}
    <Message text={error} />{!detail && <Message text={actionError} />}<View style={{ minHeight: 150 }} /><Button title="ถ่ายรูปอาหาร" icon="camera" onPress={() => router.push('/scanner')} />
    <Modal visible={dateOpen} transparent animationType="fade" onRequestClose={() => setDateOpen(false)}><View style={ui.modalOverlay}><View style={ui.modal}><Field label="เลือกวันที่ (ค.ศ.)" placeholder="12/10/2026" value={dateInput} onChangeText={setDateInput} /><Message text={dateError} /><Button title="ดูมื้ออาหาร" onPress={chooseDate} /><TouchableOpacity onPress={() => setDateOpen(false)}><Text style={ui.link}>ยกเลิก</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={!!detail} transparent animationType="slide" onRequestClose={closeDetail}><View style={ui.modalOverlay}><View style={[ui.modal, { maxHeight: '90%' }]}>{detail && <><Text style={ui.section}>{detail.menu}</Text><Text style={ui.subtitle}>กินไป {100 - detail.leftoverPercent}% · เหลือ {detail.leftoverPercent}%</Text><ScrollView style={{ flexShrink: 1 }}><Card>{DISPLAY_NUTRIENTS.map(({ key, label, unit }) => <View key={key} style={ui.between}><Text style={ui.body}>{label}</Text><Text style={ui.subtitle}>{formatNutrient(detail.eaten[key])} {unit}</Text></View>)}</Card></ScrollView><Message text={actionError} />{dayKey(new Date(detail.completedAt)) === dayKey(new Date()) && <TouchableOpacity accessibilityRole="button" disabled={changing} onPress={removeMeal} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#B3382B', fontSize: 16, fontWeight: '600' }}>{changing ? 'กำลังลบ…' : 'ลบมื้อนี้'}</Text></TouchableOpacity>}<Button title="ปิด" disabled={changing} onPress={closeDetail} /></>}</View></View></Modal>
  </Screen>;
}
