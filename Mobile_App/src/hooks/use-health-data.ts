import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getEnergyGoal, getProfile, Profile } from '@/services/profile-storage';
import { getMealHistory, CompletedMeal } from '@/services/meal-storage';
import { Nutrition, NUTRIENTS } from '@/utils/nutrition';

export function dayKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
export function totalNutrition(meals: CompletedMeal[]): Nutrition {
  return Object.fromEntries(NUTRIENTS.map(({ key }) => [key, meals.some((meal) => meal.eaten[key] === null) ? null : meals.reduce((n, meal) => n + (meal.eaten[key] ?? 0), 0)])) as Nutrition;
}
export function useHealthData(patientId?: string) {
  const [data, setData] = useState<{ profile: Profile | null; history: CompletedMeal[]; goal: number; error: string }>({ profile: null, history: [], goal: 1850, error: '' });
  useFocusEffect(useCallback(() => {
    let active = true;
    setData({ profile: null, history: [], goal: 1850, error: '' });
    Promise.all([getProfile('elderly', patientId), getMealHistory(patientId), getEnergyGoal(patientId)]).then(([profile, history, goal]) => {
      if (active) setData({ profile, history, goal, error: '' });
    }).catch(() => { if (active) setData((old) => ({ ...old, error: 'โหลดข้อมูลไม่สำเร็จ กรุณาเปิดหน้านี้ใหม่' })); });
    return () => { active = false; };
  }, [patientId]));
  const refreshHistory = async () => {
    const history = await getMealHistory(patientId);
    setData((old) => ({ ...old, history }));
  };
  const today = data.history.filter((meal) => dayKey(new Date(meal.completedAt)) === dayKey(new Date()));
  return { ...data, today, totals: totalNutrition(today), refreshHistory };
}
