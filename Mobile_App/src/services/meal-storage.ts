import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analysis, Nutrition, parseAnalysis, splitNutrition } from '@/utils/nutrition';

export type PendingMeal = Analysis & { id: string; createdAt: string };
export type CompletedMeal = PendingMeal & { leftoverPercent: number; eaten: Nutrition; remaining: Nutrition; completedAt: string; afterPhotoRecordedAt?: string; method?: 'photo' | 'manual' | 'empty' };
async function storageKey(kind: string) {
  const email = await AsyncStorage.getItem('userEmail');
  return `food:${email || 'guest'}:${kind}`;
}
export async function getMealHistory(): Promise<CompletedMeal[]> {
  const raw = await AsyncStorage.getItem(await storageKey('history'));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteTodayMeal(id: string) {
  const key = await storageKey('history');
  const history: CompletedMeal[] = JSON.parse(await AsyncStorage.getItem(key) || '[]');
  const meal = history.find((item) => item.id === id);
  if (!meal) throw new Error('ไม่พบมื้ออาหารนี้ในบัญชีปัจจุบัน');
  const completed = new Date(meal.completedAt);
  const now = new Date();
  if (completed.getFullYear() !== now.getFullYear() || completed.getMonth() !== now.getMonth() || completed.getDate() !== now.getDate()) {
    throw new Error('ลบได้เฉพาะมื้ออาหารที่บันทึกวันนี้');
  }
  const trashKey = key.replace(/:history$/, ':deleted-meals');
  const trash: CompletedMeal[] = JSON.parse(await AsyncStorage.getItem(trashKey) || '[]');
  // Keep a recoverable copy before removing the meal from active history.
  await AsyncStorage.setItem(trashKey, JSON.stringify([meal, ...trash.filter((item) => item.id !== id)]));
  await AsyncStorage.setItem(key, JSON.stringify(history.filter((item) => item.id !== id)));
}

export async function restoreDeletedMeal(id: string) {
  const trashKey = await storageKey('deleted-meals');
  const trash: CompletedMeal[] = JSON.parse(await AsyncStorage.getItem(trashKey) || '[]');
  const meal = trash.find((item) => item.id === id);
  if (!meal) throw new Error('ไม่พบมื้ออาหารที่ต้องการคืนค่าในบัญชีปัจจุบัน');
  const key = trashKey.replace(/:deleted-meals$/, ':history');
  const history: CompletedMeal[] = JSON.parse(await AsyncStorage.getItem(key) || '[]');
  const restored = [meal, ...history.filter((item) => item.id !== id)].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  await AsyncStorage.setItem(key, JSON.stringify(restored));
  await AsyncStorage.setItem(trashKey, JSON.stringify(trash.filter((item) => item.id !== id)));
}
export async function getPendingMeal(): Promise<PendingMeal | null> {
  const raw = await AsyncStorage.getItem(await storageKey('pending'));
  if (!raw) return null;
  const data = JSON.parse(raw);
  const analysis = parseAnalysis(data);
  if (typeof data.id !== 'string' || typeof data.createdAt !== 'string') throw new Error('ข้อมูลมื้ออาหารที่บันทึกไว้ไม่ถูกต้อง');
  return { ...analysis, id: data.id, createdAt: data.createdAt };
}
export async function savePendingMeal(meal: PendingMeal) {
  await AsyncStorage.setItem(await storageKey('pending'), JSON.stringify(meal));
}
export async function finishMeal(meal: PendingMeal, leftoverPercent: number, afterPhoto?: { afterPhotoRecordedAt: string; method: 'photo' | 'manual' | 'empty' }) {
  const key = await storageKey('history');
  const history = JSON.parse(await AsyncStorage.getItem(key) || '[]');
  const entry = { ...meal, ...afterPhoto, leftoverPercent, ...splitNutrition(meal.nutrition, leftoverPercent), completedAt: new Date().toISOString() };
  // Retrying after a storage error must not duplicate a meal.
  await AsyncStorage.setItem(key, JSON.stringify([entry, ...history.filter((item: PendingMeal) => item.id !== meal.id)]));
  await AsyncStorage.removeItem(await storageKey('pending'));
}
