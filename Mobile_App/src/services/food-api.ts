import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { parseAnalysis } from '@/utils/nutrition';

export function getFoodApiUrl() {
  const configured = process.env.EXPO_PUBLIC_FOOD_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
    if (!host.endsWith('.exp.direct') && !host.endsWith('.expo.dev')) return `http://${host}:5000`;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:5000`;
  throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อเซิร์ฟเวอร์อาหาร กรุณาตั้ง EXPO_PUBLIC_FOOD_API_URL แล้วเปิดแอปใหม่');
}

export async function checkFoodApiConnection() {
  const baseUrl = getFoodApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    } catch {
      throw new Error(`แอปเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (${baseUrl}) หาก Safari เข้าได้ ให้ตรวจสิทธิ์เครือข่ายท้องถิ่นของ Expo Go ในการตั้งค่า iPhone แล้วเปิดแอปใหม่`);
    }
    let data;
    try { data = await response.json(); } catch {
      throw new Error('ที่อยู่นี้ไม่ได้ตอบกลับเป็นเซิร์ฟเวอร์อาหาร กรุณาตรวจสอบที่อยู่เซิร์ฟเวอร์');
    }
    if (!response.ok || data?.status !== 'success' || data?.service !== 'food-analysis' || data?.database !== 'connected') {
      throw new Error(typeof data?.message === 'string' ? data.message : 'ติดต่อเซิร์ฟเวอร์ได้ แต่บริการอาหารหรือฐานข้อมูลยังไม่พร้อม');
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeFood(uri: string, options: { mode?: 'before' | 'after'; menuClass?: string } = {}) {
  const baseUrl = getFoodApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const body = new FormData();
    body.append('mode', options.mode ?? 'before');
    if (options.menuClass) body.append('menu_class', options.menuClass);
    if (Platform.OS === 'web') {
      const image = await fetch(uri, { signal: controller.signal });
      body.append('image', await image.blob(), 'food.jpg');
    } else {
      // SDK 57 uses Expo fetch; a legacy { uri, name, type } object cannot be encoded.
      let file: File;
      try {
        file = new File(uri);
        if (!file.exists || file.size === 0) throw new Error();
      } catch {
        throw new Error('อ่านไฟล์ภาพจากกล้องไม่ได้ กรุณาถ่ายใหม่');
      }
      if (file.size > 12 * 1024 * 1024) throw new Error('รูปภาพใหญ่เกิน 12 MB กรุณาถ่ายใหม่');
      body.append('image', file);
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body, signal: controller.signal });
    } catch {
      throw new Error(controller.signal.aborted
        ? 'เซิร์ฟเวอร์ใช้เวลานานเกินไป กรุณาลองส่งรูปอีกครั้ง'
        : `ส่งภาพไปเซิร์ฟเวอร์ไม่สำเร็จ (${baseUrl}) กดทดสอบการเชื่อมต่อด้านล่าง หากเชื่อมต่อได้ให้ถ่ายภาพใหม่แล้วลองอีกครั้ง`);
    }
    let data;
    try { data = await response.json(); } catch {
      throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${response.status}) กรุณาตรวจสอบที่อยู่เซิร์ฟเวอร์อาหาร`);
    }
    if (!response.ok || data?.status !== 'success') {
      throw new Error(typeof data?.message === 'string' ? data.message : `วิเคราะห์อาหารไม่ได้ (HTTP ${response.status})`);
    }
    return parseAnalysis(data);
  } finally {
    clearTimeout(timeout);
  }
}
