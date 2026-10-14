import { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { value: number; onChange: (value: number) => void };

function createSliderResponder(width: number, change: (next: number) => void) {
  let origin = 0;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      origin = Math.max(0, Math.min(width, event.nativeEvent.locationX - 16));
      if (width > 0) change(origin / width * 100);
    },
    onPanResponderMove: (_event, gesture) => {
      if (width > 0) change((origin + gesture.dx) / width * 100);
    },
  });
}

export default function LeftoverSlider({ value, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const change = useCallback((next: number) => onChange(Math.max(0, Math.min(100, Math.round(next)))), [onChange]);
  const responder = useMemo(() => createSliderResponder(width, change), [change, width]);
  return (
    <View>
      <Text style={styles.value}>อาหารเหลือ {value}%</Text>
      <Text style={styles.hint}>เลื่อนซ้าย–ขวาเพื่อปรับปริมาณอาหารที่เหลือ</Text>
      <View {...responder.panHandlers} style={styles.touchArea}
        onLayout={(event) => setWidth(Math.max(0, event.nativeEvent.layout.width - 32))}
        accessible accessibilityRole="adjustable" accessibilityLabel="เปอร์เซ็นต์อาหารที่เหลือ"
        accessibilityValue={{ min: 0, max: 100, now: value, text: `เหลือ ${value} เปอร์เซ็นต์` }}
        accessibilityActions={[{ name: 'increment', label: 'เพิ่มอาหารที่เหลือ' }, { name: 'decrement', label: 'ลดอาหารที่เหลือ' }]}
        onAccessibilityAction={(event) => change(value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
        <View pointerEvents="none" style={styles.track}><View style={[styles.fill, { width: `${value}%` }]} /></View>
        <View pointerEvents="none" style={[styles.thumb, { left: width * value / 100 }]} />
      </View>
      <View style={styles.labels}><Text>0% กินหมด</Text><Text>100% ยังไม่ได้กิน</Text></View>
      <View style={styles.controls}>
        <TouchableOpacity accessibilityLabel="ลดอาหารที่เหลือ 1 เปอร์เซ็นต์" style={styles.adjust} onPress={() => change(value - 1)}><Text style={styles.adjustText}>−</Text></TouchableOpacity>
        {[0, 25, 50, 75, 100].map((n) => <TouchableOpacity key={n} onPress={() => change(n)} style={[styles.preset, value === n && styles.selected]}><Text style={styles.presetText}>{n}%</Text></TouchableOpacity>)}
        <TouchableOpacity accessibilityLabel="เพิ่มอาหารที่เหลือ 1 เปอร์เซ็นต์" style={styles.adjust} onPress={() => change(value + 1)}><Text style={styles.adjustText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  value: { fontSize: 26, fontWeight: '700', color: '#1C6741', textAlign: 'center' },
  hint: { fontSize: 14, textAlign: 'center', color: '#64736B', marginVertical: 10 },
  touchArea: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  track: { height: 8, backgroundColor: '#E2EDE6', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#1C6741' },
  thumb: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C6741', borderColor: '#FFF', borderWidth: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 3 },
  adjust: { minWidth: 36, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  adjustText: { fontSize: 26, color: '#1C6741' },
  preset: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  presetText: { fontSize: 13, color: '#1C6741' },
  selected: { backgroundColor: '#E2EDE6' },
});
