import { Text, View } from 'react-native';
import { formatNutrient } from '@/utils/nutrition';

export default function EnergyBar({ value, total, label = 'พลังงาน', unit = 'kcal' }: { value: number | null; total: number | null; label?: string; unit?: string }) {
  const known = value !== null && total !== null;
  const percent = known && total > 0 ? Math.max(0, Math.min(100, value / total * 100)) : 0;
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ fontSize: 16, fontWeight: '700', color: '#216440', flexShrink: 1 }}>{label}</Text><Text style={{ fontSize: 15, color: '#202824' }}>{formatNutrient(value)} {unit}</Text></View>
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={known ? { min: 0, max: 100, now: Math.round(percent) } : { text: `ยังไม่มีข้อมูล${label}` }} style={{ height: 22, borderRadius: 11, backgroundColor: '#E3EEE7', overflow: 'hidden' }}><View style={{ height: '100%', width: `${percent}%`, backgroundColor: '#216440', borderRadius: 11 }} /></View>
    {!known && <Text style={{ fontSize: 12, color: '#818982' }}>รอข้อมูลโภชนาการอ้างอิง</Text>}
  </View>;
}
