const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const nutrition = load('src/utils/nutrition.ts');
test('pending meal survives reopening, history is user scoped and retry is idempotent', async () => {
  const values = new Map([['userEmail', 'one@example.com']]);
  const storage = { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async (key) => values.delete(key) };
  const create = () => load('src/services/meal-storage.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, '@/utils/nutrition': nutrition,
  });
  const meal = { ...nutrition.parseAnalysis({ menu: 'ข้าว', nutrition: { calories: 500 }, calibrated: true, comparisonReady: true, portions: [{ className: 'rice', grams: 200, relativeArea: 2 }] }), id: 'meal1', createdAt: '2026-10-12T00:00:00Z' };
  await create().savePendingMeal(meal);
  assert.equal((await create().getPendingMeal()).id, 'meal1');
  assert.equal((await create().getPendingMeal()).calibrated, true);
  assert.equal((await create().getPendingMeal()).comparisonReady, true);
  assert.equal((await create().getPendingMeal()).portions[0].grams, 200);
  values.set('userEmail', 'two@example.com');
  assert.equal(await create().getPendingMeal(), null);
  values.set('userEmail', 'one@example.com');
  await create().finishMeal(meal, 25);
  await create().finishMeal(meal, 25);
  const history = JSON.parse(values.get('food:one@example.com:history'));
  assert.equal(history.length, 1);
  assert.equal(history[0].eaten.calories, 375);
  assert.equal(history[0].remaining.calories, 125);
  assert.equal((await create().getMealHistory())[0].eaten.calories, 375);
  assert.equal(await create().getPendingMeal(), null);
});

test('deleting today is account scoped, preserves other dates and pending meals, and can be undone', async () => {
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const entry = (id, kcal, date = now) => ({ ...nutrition.parseAnalysis({ menu: id, nutrition: { calories: kcal } }), id, createdAt: date.toISOString(), completedAt: date.toISOString(), leftoverPercent: 0, ...nutrition.splitNutrition(nutrition.parseAnalysis({ menu: id, nutrition: { calories: kcal } }).nutrition, 0) });
  const original = [entry('delete-me', 500), entry('keep-me', 200), entry('yesterday', 300, yesterday)];
  const values = new Map([['userEmail', 'one@example.com'], ['food:one@example.com:history', JSON.stringify(original)], ['food:one@example.com:pending', 'pending-sentinel'], ['food:two@example.com:history', JSON.stringify([entry('delete-me', 900)])]]);
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const service = load('src/services/meal-storage.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, '@/utils/nutrition': nutrition,
  });
  await assert.rejects(service.deleteTodayMeal('yesterday'), /เฉพาะมื้ออาหารที่บันทึกวันนี้/);
  await service.deleteTodayMeal('delete-me');
  let active = await service.getMealHistory();
  assert.equal(active.length, 2);
  assert.equal(active.filter(item => item.completedAt === now.toISOString()).reduce((sum, item) => sum + item.eaten.calories, 0), 200);
  assert.equal(JSON.parse(values.get('food:two@example.com:history'))[0].eaten.calories, 900);
  assert.equal(values.get('food:one@example.com:pending'), 'pending-sentinel');
  values.set('userEmail', 'two@example.com');
  await assert.rejects(service.restoreDeletedMeal('delete-me'), /บัญชีปัจจุบัน/);
  values.set('userEmail', 'one@example.com');
  await service.restoreDeletedMeal('delete-me');
  active = await service.getMealHistory();
  assert.equal(active.length, 3);
  assert.equal(active.find(item => item.id === 'delete-me').eaten.calories, 500);
  assert.equal(JSON.parse(values.get('food:one@example.com:deleted-meals')).length, 0);
});

test('failed recovery-copy write leaves the original history intact', async () => {
  const meal = { id: 'today', completedAt: new Date().toISOString() };
  const history = JSON.stringify([meal]);
  const values = new Map([['userEmail', 'one@example.com'], ['food:one@example.com:history', history]]);
  const service = load('src/services/meal-storage.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async key => values.get(key) ?? null,
      setItem: async () => { throw new Error('storage full'); },
    } }, '@/utils/nutrition': nutrition,
  });
  await assert.rejects(service.deleteTodayMeal('today'), /storage full/);
  assert.equal(values.get('food:one@example.com:history'), history);
});
