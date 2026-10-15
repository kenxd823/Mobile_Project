export type ReminderPrefs = { meals: boolean; afterMeal: boolean };
export type ReminderContext = { owner: string; email: string; patientId: string | null; prefs: ReminderPrefs; pending: { id: string; createdAt: string; startedAt?: string } | null };
export const REMINDER_APP = 'ncd-food-reminders';
export function buildReminderPlan(context: ReminderContext, now = Date.now()) {
  const data = { app: REMINDER_APP, owner: context.owner, email: context.email, patientId: context.patientId };
  const plan: { identifier: string; title: string; body: string; data: Record<string, string | null>; hour?: number; minute?: number; date?: number }[] = [];
  if (context.prefs.meals) {
    for (const [slot, label, hour, minute] of [['breakfast', 'มื้อเช้า', 8, 0], ['lunch', 'มื้อกลางวัน', 12, 0], ['dinner', 'มื้อเย็น', 18, 30]] as const) {
      plan.push({ identifier: `ncd-meal-${slot}`, title: `ถึงเวลาบันทึก${label}`, body: 'อย่าลืมถ่ายอาหารก่อนกินและบันทึกมื้อนี้', data: { ...data, kind: 'meal' }, hour, minute });
    }
  }
  if (context.prefs.afterMeal && context.pending) {
    const start = new Date(context.pending.startedAt ?? context.pending.createdAt).getTime();
    for (const minutes of [30, 60]) {
      const date = start + minutes * 60000;
      if (Number.isFinite(date) && date > now) plan.push({ identifier: `ncd-after-${context.pending.id}-${minutes}`, title: 'อย่าลืมถ่ายรูปหลังกิน', body: 'ถ้ากินเสร็จแล้ว ถ่ายอาหารที่เหลือและบันทึกให้ครบ', data: { ...data, kind: 'after', mealId: context.pending.id }, date });
    }
  }
  return plan;
}
