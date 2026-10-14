import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BottomNav, Card, Icon, Message, palette, Screen, ui } from '@/components/design-system';
import { Ring } from '@/components/health-cards';
import { dayKey, totalNutrition, useHealthData } from '@/hooks/use-health-data';
import { formatNutrient } from '@/utils/nutrition';

export default function DashboardScreen() {
  const { history, goal, error } = useHealthData();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
  const [selected, setSelected] = useState(dayKey(new Date()));
  const current = history.filter((meal) => dayKey(new Date(meal.completedAt)) === selected);
  const total = totalNutrition(current);
  const kcal = total.calories ?? 0;
  const week = days.map((date) => {
    const meals = history.filter((meal) => dayKey(new Date(meal.completedAt)) === dayKey(date));
    return { date, hasData: meals.length > 0, kcal: totalNutrition(meals).calories, leftover: meals.length ? meals.reduce((sum, meal) => sum + meal.leftoverPercent, 0) / meals.length : null };
  });
  const energyValues = week.filter((day) => day.hasData).map((day) => day.kcal).filter((n): n is number => n !== null);
  const avg = energyValues.length ? energyValues.reduce((a, b) => a + b, 0) / energyValues.length : 0;
  return <Screen dense bottom={<BottomNav active="dashboard" />}>
    <View style={ui.between}><Text style={ui.title}>แดชบอร์ดสุขภาพ</Text><Icon name="bell" color={palette.ink} /></View>
    <View style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 16, flexDirection: 'row', padding: 5, marginTop: 10 }}>
      {days.map((day) => <TouchableOpacity key={dayKey(day)} onPress={() => setSelected(dayKey(day))} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, gap: 5, borderRadius: 10, backgroundColor: selected === dayKey(day) ? palette.green : '#FFF' }}><Text style={{ fontSize: 9, color: selected === dayKey(day) ? '#FFF' : palette.muted }}>{day.toLocaleDateString('th-TH', { weekday: 'narrow' })}</Text><Text style={{ fontSize: 12, color: selected === dayKey(day) ? '#FFF' : palette.ink }}>{day.getDate()}</Text></TouchableOpacity>)}
    </View>
    <Card><View style={ui.row}><Ring percent={kcal / goal * 100} size={100}><Text style={{ fontSize: 25, fontWeight: '700', color: palette.ink }}>{Math.round(kcal / goal * 100)}%</Text><Text style={{ fontSize: 9, color: palette.muted }}>ของเป้าพลังงาน</Text></Ring><View style={{ flex: 1, gap: 6 }}><Text style={ui.section}>สรุปประจำวัน</Text><Text style={ui.subtitle}>{current.length ? 'บันทึกอาหารแล้ว ' + current.length + ' มื้อ ติดตามสารอาหารได้ที่หน้าแรก' : 'ยังไม่มีมื้ออาหารที่บันทึกในวันนี้'}</Text><Text style={{ color: palette.green, fontSize: 12 }}>เป้าหมาย {goal.toLocaleString()} kcal</Text></View></View></Card>
    <Card compact><View style={ui.between}><Icon name="sun" size={18} /><Text style={ui.subtitle}>พลังงาน</Text></View><Text style={{ fontSize: 23, fontWeight: '700', color: palette.ink }}>{formatNutrient(total.calories)}</Text><Text style={{ fontSize: 10, color: palette.muted }}>{Math.round(kcal / goal * 100)}% ของเป้า</Text></Card>
    {(['energy', 'leftover'] as const).map((kind) => <Card key={kind} compact>
      <View style={ui.between}><Text style={ui.section}>{kind === 'energy' ? 'พลังงาน 7 วัน' : 'การกินเหลือ 7 วัน'}</Text><Text style={{ color: palette.green, fontSize: 11 }}>{kind === 'energy' ? 'เฉลี่ย ' + Math.round(avg).toLocaleString() : '%'}</Text></View>
      <View style={{ height: 85, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        {week.map((day) => { const value = kind === 'energy' ? day.kcal : day.leftover; const max = kind === 'energy' ? Math.max(goal, ...energyValues) : 100;
          return <View key={dayKey(day.date)} style={{ flex: 1, alignItems: 'center', gap: 8 }}><View accessibilityLabel={day.date.toLocaleDateString('th-TH') + ': ' + (value === null ? 'ไม่มีข้อมูล' : Math.round(value))} style={{ width: '75%', height: Math.max(4, (value ?? 0) / max * 65), borderRadius: 6, backgroundColor: kind === 'energy' ? selected === dayKey(day.date) ? palette.green : '#DDEEE3' : selected === dayKey(day.date) ? palette.gold : '#E8DCC1' }} /><Text style={{ fontSize: 9, color: palette.muted }}>{day.date.toLocaleDateString('th-TH', { weekday: 'narrow' })}</Text></View>; })}
      </View>
      {!history.length && <Text style={{ color: palette.muted, fontSize: 11 }}>กราฟจะแสดงเมื่อมีมื้ออาหารที่บันทึก</Text>}
    </Card>)}
    <Message text={error} />
  </Screen>;
}
