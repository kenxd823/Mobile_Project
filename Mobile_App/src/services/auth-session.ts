import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountError, accountRequest } from './account-api';

export type AccountSession = { email: string; token: string };
const CLEANUP_KEY = 'pendingAccountCleanup';
export class AccountDeletedCleanupError extends Error {
  constructor() { super('ลบบัญชีจากเซิร์ฟเวอร์แล้ว แต่ล้างข้อมูลในเครื่องไม่สำเร็จ กรุณาเปิดแอปใหม่เพื่อลองล้างข้อมูลอีกครั้ง'); }
}

export async function resumeAccountCleanup() {
  const email = await AsyncStorage.getItem(CLEANUP_KEY);
  if (!email) return;
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`profile:${email}:`) || key.startsWith(`food:${email}:`));
  await AsyncStorage.multiRemove(keys);
  if (await AsyncStorage.getItem('userEmail') === email) await clearSession();
  await AsyncStorage.removeItem(CLEANUP_KEY);
}

export async function deleteAccountSession(session: AccountSession, password: string) {
  if (!password) throw new Error('กรุณากรอกรหัสผ่านเพื่อยืนยันการลบบัญชี');
  const data = await accountRequest('delete-account', { password }, session.token);
  if (data.status !== 'success') throw new Error('เซิร์ฟเวอร์ยังไม่ได้ยืนยันการลบบัญชี กรุณาลองใหม่');
  try {
    await AsyncStorage.setItem(CLEANUP_KEY, session.email);
    await resumeAccountCleanup();
    await clearSession();
  } catch {
    try { await clearSession(); } catch { /* AuthProvider also drops in-memory access after server deletion. */ }
    throw new AccountDeletedCleanupError();
  }
}
export async function storeSession(value: AccountSession) {
  if (!value?.token || !value.email) throw new Error('เซิร์ฟเวอร์ไม่ได้ยืนยันการเข้าสู่ระบบ กรุณาลองใหม่');
  await resumeAccountCleanup();
  await AsyncStorage.removeItem('authToken');
  await AsyncStorage.setItem('userEmail', value.email);
  await AsyncStorage.setItem('authToken', value.token);
}
export async function clearSession() {
  await AsyncStorage.removeItem('authToken');
  await AsyncStorage.removeItem('userEmail');
  await AsyncStorage.removeItem('userRole');
}
export async function restoreSession(): Promise<AccountSession | null> {
  await resumeAccountCleanup();
  const token = await AsyncStorage.getItem('authToken');
  if (!token) { await clearSession(); return null; }
  try {
    const data = await accountRequest('session', undefined, token);
    if (typeof data.email !== 'string' || !data.email) throw new Error('ข้อมูลบัญชีไม่ถูกต้อง');
    await AsyncStorage.setItem('userEmail', data.email);
    return { email: data.email, token };
  } catch (error) {
    if (error instanceof AccountError && error.status === 401) { await clearSession(); return null; }
    throw error;
  }
}
