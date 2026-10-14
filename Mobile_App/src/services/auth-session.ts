import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountError, accountRequest } from './account-api';

export type AccountSession = { email: string; token: string };
export async function storeSession(value: AccountSession) {
  if (!value?.token || !value.email) throw new Error('เซิร์ฟเวอร์ไม่ได้ยืนยันการเข้าสู่ระบบ กรุณาลองใหม่');
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
