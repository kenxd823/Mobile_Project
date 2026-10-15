const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const planner = load('src/utils/reminder-plan.ts');

function setup({ granted = true, os = 'ios' } = {}) {
  const email = 'one@example.test';
  const values = new Map([['userEmail', email], [`profile:${email}:activePatient`, 'a']]);
  let scheduled = [], presented = [], requests = 0;
  const api = {
    setNotificationHandler() {}, AndroidImportance: { DEFAULT: 3 }, IosAuthorizationStatus: { PROVISIONAL: 1 }, SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
    setNotificationChannelAsync: async () => {}, getPermissionsAsync: async () => ({ granted, ios: { status: 0 } }),
    requestPermissionsAsync: async () => { requests++; return { granted, ios: { status: 0 } }; },
    getAllScheduledNotificationsAsync: async () => scheduled.slice(), getPresentedNotificationsAsync: async () => presented.slice(),
    cancelScheduledNotificationAsync: async id => { scheduled = scheduled.filter(item => item.identifier !== id); },
    dismissNotificationAsync: async id => { presented = presented.filter(item => item.request.identifier !== id); },
    scheduleNotificationAsync: async item => { scheduled.push(item); return item.identifier; },
  };
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const service = load('src/services/meal-reminders.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, 'react-native': { Platform: { OS: os } },
    '@/utils/reminder-plan': planner, 'expo-notifications': api,
  }, { Date, Error });
  return { ...service, values, api, scheduled: () => scheduled, requests: () => requests, presented: value => { presented = value; }, setGranted: value => { granted = value; }, email };
}

test('daily meal times and after-meal reminders use the meal start, not analysis time or time of reopening', () => {
  const now = new Date('2026-10-15T05:00:00Z').getTime();
  const plan = planner.buildReminderPlan({ owner: 'scope', email: 'test', patientId: 'a', prefs: { meals: true, afterMeal: true }, pending: { id: 'meal', createdAt: '2026-10-15T04:00:00Z', startedAt: '2026-10-15T05:00:00Z' } }, now);
  assert.deepEqual(Array.from(plan.filter(p => p.hour !== undefined), p => `${p.hour}:${p.minute}`), ['8:0', '12:0', '18:30']);
  assert.deepEqual(Array.from(plan.filter(p => p.date), p => p.date - now), [30 * 60000, 60 * 60000]);
  assert.equal(planner.buildReminderPlan({ owner: 'scope', email: 'test', patientId: null, prefs: { meals: false, afterMeal: true }, pending: { id: 'old', createdAt: '2026-10-14T00:00:00Z' } }, now).length, 0);
});

test('schedules are idempotent and finishing a meal cancels its two reminders', async () => {
  const h = setup();
  h.values.set(`profile:${h.email}:reminders:patient:a`, JSON.stringify({ meals: true, afterMeal: true }));
  h.values.set(`food:${h.email}:patient:a:pending`, JSON.stringify({ id: 'meal', createdAt: new Date().toISOString() }));
  await h.syncMealReminders(); assert.equal(h.scheduled().length, 5);
  const dates = h.scheduled().filter(item => item.trigger.date).map(item => item.trigger.date.getTime());
  await h.syncMealReminders(); assert.equal(h.scheduled().length, 5);
  assert.deepEqual(h.scheduled().filter(item => item.trigger.date).map(item => item.trigger.date.getTime()), dates);
  h.values.delete(`food:${h.email}:patient:a:pending`);
  await h.syncMealReminders(); assert.equal(h.scheduled().length, 3);
  assert.ok(h.scheduled().every(item => item.content.data.kind === 'meal'));
});

test('permission denial does not falsely enable reminders; disabling works without permission', async () => {
  const h = setup({ granted: false });
  await assert.rejects(h.saveReminderPreferences({ meals: true, afterMeal: true }), /ยังไม่ได้รับอนุญาต/);
  assert.equal(h.scheduled().length, 0);
  assert.equal(h.values.has(`profile:${h.email}:reminders:patient:a`), false);
  assert.equal(h.requests(), 1);
  await h.saveReminderPreferences({ meals: false, afterMeal: false });
  assert.equal(h.requests(), 1);
  assert.equal(h.scheduled().length, 0);
});

test('scheduling failure rolls back the enabled setting instead of reporting reminders as active', async () => {
  const h = setup();
  h.api.scheduleNotificationAsync = async () => { throw new Error('native scheduler unavailable'); };
  await assert.rejects(h.saveReminderPreferences({ meals: true, afterMeal: true }), /native scheduler/);
  assert.equal((await h.getReminderPreferences()).meals, false);
  assert.equal(h.scheduled().length, 0);
});

test('revoking system permission does not prevent turning off either reminder switch', async () => {
  const h = setup({ granted: false });
  h.values.set(`profile:${h.email}:reminders:patient:a`, JSON.stringify({ meals: true, afterMeal: true }));
  await h.saveReminderPreferences({ meals: false, afterMeal: true });
  assert.equal((await h.getReminderPreferences()).meals, false);
  assert.equal(h.requests(), 0);
});

test('patient switching, account switching and logout never retain another person\'s scheduled reminders', async () => {
  const h = setup();
  h.values.set(`food:${h.email}:patient:a:pending`, JSON.stringify({ id: 'a-meal', createdAt: new Date().toISOString() }));
  await h.syncMealReminders(); assert.equal(h.scheduled().length, 2);
  const old = h.scheduled()[0].content.data;
  h.values.set(`profile:${h.email}:activePatient`, 'b');
  await h.syncMealReminders(); assert.equal(h.scheduled().length, 0);
  assert.equal(await h.reminderDestination(old), '/select-elderly');
  h.values.set('userEmail', 'other@example.test');
  assert.equal(await h.reminderDestination(old), null);
  h.values.delete('userEmail'); await h.syncMealReminders();
  assert.equal(h.scheduled().length, 0);
});

test('notification taps only open the pending meal they refer to, and web does not claim background delivery', async () => {
  const h = setup();
  h.values.set(`food:${h.email}:patient:a:pending`, JSON.stringify({ id: 'meal', createdAt: new Date().toISOString() }));
  await h.syncMealReminders();
  const data = h.scheduled()[0].content.data;
  assert.equal(await h.reminderDestination(data), '/scanner');
  h.values.delete(`food:${h.email}:patient:a:pending`);
  assert.equal(await h.reminderDestination(data), '/food-log');
  const web = setup({ os: 'web' });
  assert.equal((await web.syncMealReminders(true)).supported, false);
  await assert.rejects(web.saveReminderPreferences({ meals: true, afterMeal: true }), /บนมือถือ/);
  assert.equal(web.requests(), 0);
});
