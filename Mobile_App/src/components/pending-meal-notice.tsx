import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, ui } from './design-system';
import { getPendingMeal } from '@/services/meal-storage';

export default function PendingMealNotice() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    getPendingMeal().then(meal => { if (active) setPending(!!meal); }).catch(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, []));
  if (!pending) return null;
  return <Card><Text style={ui.section}>อย่าลืมถ่ายรูปหลังกิน</Text><Text style={ui.subtitle}>มีมื้อที่เริ่มกินแล้วและยังบันทึกไม่เสร็จ ถ้ากินเสร็จแล้วให้ถ่ายอาหารที่เหลือ</Text><Button title="ถ่ายภาพหลังกิน / บันทึกต่อ" icon="camera" onPress={() => router.push('/scanner')} /></Card>;
}
