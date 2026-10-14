import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getAccountApiUrl() {
  const configured = process.env.EXPO_PUBLIC_ACCOUNT_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:8000`;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
    if (!host.endsWith('.exp.direct') && !host.endsWith('.expo.dev')) return `http://${host}:8000`;
  }
  throw new Error('กรุณาตั้งค่าที่อยู่เซิร์ฟเวอร์บัญชีผู้ใช้');
}

export class AccountError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function accountRequest(path: string, body?: unknown, token?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${getAccountApiUrl()}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw new AccountError(typeof data.detail === 'string' ? data.detail : 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูล', response.status);
    return data;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์บัญชีผู้ใช้ไม่ได้ กรุณาเปิดเซิร์ฟเวอร์ที่พอร์ต 8000 แล้วลองใหม่');
  } finally { clearTimeout(timeout); }
}
