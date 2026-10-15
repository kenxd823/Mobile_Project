import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { buildReminderPlan, REMINDER_APP, ReminderContext, ReminderPrefs } from '@/utils/reminder-plan';

const CHANNEL = 'food-reminders';
async function context(): Promise<ReminderContext | null> {
  const email = await AsyncStorage.getItem('userEmail');
  if (!email) return null;
  const patientId = await AsyncStorage.getItem(`profile:${email}:activePatient`);
  const owner = `profile:${email}:reminders${patientId ? `:patient:${patientId}` : ''}`;
  const saved = JSON.parse(await AsyncStorage.getItem(owner) || '{}');
  const legacy = JSON.parse(await AsyncStorage.getItem(`profile:${email}:preferences`) || '{}');
  const pending = JSON.parse(await AsyncStorage.getItem(`food:${email}${patientId ? `:patient:${patientId}` : ''}:pending`) || 'null');
  return { email, patientId, owner, prefs: { meals: saved.meals ?? !!legacy.meals, afterMeal: saved.afterMeal ?? true }, pending };
}
export async function getReminderPreferences(): Promise<ReminderPrefs> { return (await context())?.prefs ?? { meals: false, afterMeal: true }; }

export async function notificationApi() {
  const api = await import('expo-notifications');
  api.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  return api;
}
async function permission(request: boolean) {
  const api = await notificationApi();
  if (Platform.OS === 'android') await api.setNotificationChannelAsync(CHANNEL, { name: 'เตือนบันทึกอาหาร', importance: api.AndroidImportance.DEFAULT, sound: 'default' });
  let value = await api.getPermissionsAsync();
  const allowed = () => value.granted || value.ios?.status === api.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed() && request) value = await api.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return allowed();
}
export async function cancelMealReminders() {
  if (Platform.OS === 'web') return;
  const api = await notificationApi();
  for (const item of await api.getAllScheduledNotificationsAsync()) if (item.content.data?.app === REMINDER_APP) await api.cancelScheduledNotificationAsync(item.identifier);
  for (const item of await api.getPresentedNotificationsAsync()) if (item.request.content.data?.app === REMINDER_APP) await api.dismissNotificationAsync(item.request.identifier);
}
let queue = Promise.resolve();
export function syncMealReminders(requestPermission = false): Promise<{ supported: boolean; allowed: boolean; afterMeal: boolean }> {
  const next = queue.then(() => syncInternal(requestPermission));
  queue = next.then(() => {}, () => {});
  return next;
}
async function syncInternal(request: boolean) {
  if (Platform.OS === 'web') return { supported: false, allowed: false, afterMeal: false };
  const current = await context();
  if (!current) { await cancelMealReminders(); return { supported: true, allowed: false, afterMeal: false }; }
  const allowed = await permission(request && (current.prefs.afterMeal || current.prefs.meals));
  const api = await notificationApi();
  const plan = allowed ? buildReminderPlan(current) : [];
  const scheduled = (await api.getAllScheduledNotificationsAsync()).filter(item => item.content.data?.app === REMINDER_APP);
  for (const item of scheduled) {
    if (item.content.data?.owner !== current.owner || !plan.some(next => next.identifier === item.identifier)) await api.cancelScheduledNotificationAsync(item.identifier);
  }
  for (const item of plan) {
    if (scheduled.some(old => old.identifier === item.identifier && old.content.data?.owner === current.owner)) continue;
    await api.scheduleNotificationAsync({ identifier: item.identifier, content: { title: item.title, body: item.body, sound: 'default', data: item.data }, trigger: item.date !== undefined ? { type: api.SchedulableTriggerInputTypes.DATE, date: new Date(item.date), channelId: CHANNEL } : { type: api.SchedulableTriggerInputTypes.DAILY, hour: item.hour!, minute: item.minute!, channelId: CHANNEL } });
  }
  for (const item of await api.getPresentedNotificationsAsync()) {
    const data = item.request.content.data;
    if (data?.app === REMINDER_APP && (data.owner !== current.owner || (data.kind === 'after' ? !current.prefs.afterMeal || data.mealId !== current.pending?.id : !current.prefs.meals))) await api.dismissNotificationAsync(item.request.identifier);
  }
  return { supported: true, allowed, afterMeal: current.prefs.afterMeal };
}
export async function saveReminderPreferences(prefs: ReminderPrefs) {
  const current = await context();
  if (!current) throw new Error('กรุณาเข้าสู่ระบบก่อนตั้งเตือน');
  if ((prefs.meals && !current.prefs.meals) || (prefs.afterMeal && !current.prefs.afterMeal)) {
    if (Platform.OS === 'web') throw new Error('การแจ้งเตือนเมื่อปิดแอปใช้บนมือถือ ส่วนเว็บมีข้อความเตือนมื้อที่ยังไม่เสร็จในแอป');
    if (!await permission(true)) throw new Error('ยังไม่ได้รับอนุญาตแจ้งเตือน กรุณาเปิดสิทธิ์ในการตั้งค่ามือถือ');
  }
  const previous = await AsyncStorage.getItem(current.owner);
  await AsyncStorage.setItem(current.owner, JSON.stringify(prefs));
  try { await syncMealReminders(); }
  catch (error) {
    if (previous === null) await AsyncStorage.removeItem(current.owner);
    else await AsyncStorage.setItem(current.owner, previous);
    try { await syncMealReminders(); } catch { /* Preserve the previous setting and report the original scheduling failure. */ }
    throw error;
  }
}
export async function reminderDestination(data: Record<string, unknown>): Promise<'/scanner' | '/food-log' | '/select-elderly' | null> {
  const current = await context();
  if (!current || data.app !== REMINDER_APP || data.email !== current.email) return null;
  if (data.owner !== current.owner) return '/select-elderly';
  return data.kind === 'after' && data.mealId === current.pending?.id ? '/scanner' : '/food-log';
}
