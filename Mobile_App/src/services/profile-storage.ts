import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileMetrics } from '@/utils/profile-metrics';
export type Profile = { firstName: string; lastName: string; dob: string; phone: string; gender: string; weight: string; height: string; diseases: string[]; relationship?: string };
export type Patient = { id: string; firstName: string; lastName: string; phone: string; gender: string };
export const emptyProfile: Profile = { firstName: '', lastName: '', dob: '', phone: '', gender: '', weight: '', height: '', diseases: [] };
export async function userKey(name: string) { return `profile:${await AsyncStorage.getItem('userEmail') || 'guest'}:${name}`; }
export async function getProfile(role = 'elderly'): Promise<Profile | null> {
  const data = await AsyncStorage.getItem(await userKey(role));
  return data ? JSON.parse(data) : null;
}
export async function saveProfile(profile: Profile, role = 'elderly') { await AsyncStorage.setItem(await userKey(role), JSON.stringify(profile)); }
export async function getPatients(): Promise<Patient[]> { return JSON.parse(await AsyncStorage.getItem(await userKey('patients')) || '[]'); }
export async function savePatients(patients: Patient[]) { await AsyncStorage.setItem(await userKey('patients'), JSON.stringify(patients)); }
export async function getEnergyGoal(): Promise<number> {
  const n = Number(await AsyncStorage.getItem(await userKey('energyGoal')));
  if (Number.isFinite(n) && n > 0) return n;
  return profileMetrics(await getProfile()).energy ?? 1850;
}
export async function saveEnergyGoal(goal: number) { await AsyncStorage.setItem(await userKey('energyGoal'), String(goal)); }
export async function resetEnergyGoal() { await AsyncStorage.removeItem(await userKey('energyGoal')); }
