import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileMetrics } from '@/utils/profile-metrics';
export type Profile = { firstName: string; lastName: string; dob: string; phone: string; gender: string; weight: string; height: string; diseases: string[]; relationship?: string };
export type Patient = Pick<Profile, 'firstName' | 'lastName' | 'phone' | 'gender'> & Partial<Omit<Profile, 'firstName' | 'lastName' | 'phone' | 'gender'>> & { id: string };
export const emptyProfile: Profile = { firstName: '', lastName: '', dob: '', phone: '', gender: '', weight: '', height: '', diseases: [] };
export async function userKey(name: string) { return `profile:${await AsyncStorage.getItem('userEmail') || 'guest'}:${name}`; }
export async function getProfile(role = 'elderly', patientId?: string): Promise<Profile | null> {
  if (role === 'elderly') {
    const id = patientId ?? await getActivePatientId();
    if (id) {
      const patient = (await getPatients()).find(item => item.id === id);
      if (!patient) throw new Error('ไม่พบรายชื่อผู้สูงอายุที่เลือก กรุณาเลือกรายชื่อใหม่');
      return { ...emptyProfile, ...patient };
    }
  }
  const data = await AsyncStorage.getItem(await userKey(role));
  return data ? JSON.parse(data) : null;
}
export async function getPersonalProfile(): Promise<Profile | null> {
  const data = await AsyncStorage.getItem(await userKey('elderly'));
  return data ? { ...emptyProfile, ...JSON.parse(data) } : null;
}
export async function saveProfile(profile: Profile, role = 'elderly') {
  const id = role === 'elderly' ? await getActivePatientId() : null;
  if (id) { await savePatient(profile, id); return; }
  await AsyncStorage.setItem(await userKey(role), JSON.stringify(profile));
}
export async function getPatients(): Promise<Patient[]> { return JSON.parse(await AsyncStorage.getItem(await userKey('patients')) || '[]'); }
export async function savePatients(patients: Patient[]) { await AsyncStorage.setItem(await userKey('patients'), JSON.stringify(patients)); }
export async function getActivePatientId() { return AsyncStorage.getItem(await userKey('activePatient')); }
export async function selectPatient(id: string | null) {
  if (id && !(await getPatients()).some(patient => patient.id === id)) throw new Error('ไม่พบรายชื่อผู้สูงอายุนี้');
  const key = await userKey('activePatient');
  if (id) await AsyncStorage.setItem(key, id);
  else await AsyncStorage.removeItem(key);
}
export async function savePatient(profile: Profile, id?: string) {
  const patients = await getPatients();
  if (id && !patients.some(patient => patient.id === id)) throw new Error('ไม่พบรายชื่อผู้สูงอายุนี้');
  const patient = { ...profile, id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  await savePatients(id ? patients.map(item => item.id === id ? patient : item) : [...patients, patient]);
  return patient;
}
async function energyGoalKey(patientId?: string) {
  const id = patientId ?? await getActivePatientId();
  return `${await userKey('energyGoal')}${id ? `:patient:${id}` : ''}`;
}
export async function getEnergyGoal(patientId?: string): Promise<number> {
  const calculated = profileMetrics(await getProfile('elderly', patientId)).energy;
  if (calculated !== null) return calculated;
  const n = Number(await AsyncStorage.getItem(await energyGoalKey(patientId)));
  if (Number.isFinite(n) && n > 0) return n;
  return 1850;
}
export async function saveEnergyGoal(goal: number) { await AsyncStorage.setItem(await energyGoalKey(), String(goal)); }
export async function resetEnergyGoal() { await AsyncStorage.removeItem(await energyGoalKey()); }
