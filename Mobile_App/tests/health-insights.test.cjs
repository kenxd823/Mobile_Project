const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const nutrition = load('src/utils/nutrition.ts');
const { getHealthInsights } = load('src/utils/health-insights.ts', { '@/utils/nutrition': { ...nutrition, ENABLE_FOOD_GROUP_TRACKING: true } });
const now = new Date(2026, 9, 15, 14);
const groups = Array.from(nutrition.FOOD_GROUPS, item => item.key);

function meal(daysAgo, index, changes = {}) {
  const values = Object.fromEntries(nutrition.NUTRIENTS.map(({ key }) => [key, 0]));
  Object.assign(values, { calories: 700, protein: 30, fiber: 10 });
  return {
    id: `${daysAgo}-${index}`, menu: `เมนู ${daysAgo}-${index}`, nutrition: values,
    eaten: values, remaining: values, leftoverPercent: 0,
    createdAt: new Date(2026, 9, 15 - daysAgo, 8 + index * 4).toISOString(),
    completedAt: new Date(2026, 9, 15 - daysAgo, 9 + index * 4).toISOString(),
    foodGroups: groups, foodGroupsConfirmed: true, ...changes,
  };
}
function history(days = 3, count = 3, customize = () => ({})) {
  return Array.from({ length: days }, (_, day) =>
    Array.from({ length: count }, (_, index) => meal(day + 1, index, customize(day + 1, index)))
  ).flat();
}
const ids = result => Array.from(result.alerts, alert => alert.id);

test('no records or too few daily meals never become low intake or a missing food group', () => {
  const empty = getHealthInsights([], 1850, now);
  assert.deepEqual(ids(empty), []);
  assert.equal(empty.canCheckTrend, false);
  const sparse = getHealthInsights(history(3, 2, () => ({ eaten: { calories: 0, protein: 0, fiber: 0 } })), 1850, now);
  assert.deepEqual(ids(sparse), []);
  assert.equal(sparse.canCheckGroups, false);
});

test('only completed past calendar days count; today, future and invalid dates do not complete history', () => {
  const records = [...history(2), ...[0, 1, 2].map(index => meal(0, index)), meal(-1, 0), meal(3, 0, { completedAt: 'invalid' })];
  const result = getHealthInsights(records, 1850, now);
  assert.equal(result.daysWithEnoughMeals, 2);
  assert.equal(result.canCheckTrend, false);
});

test('duplicates and nonconsecutive days cannot manufacture three complete days', () => {
  const records = history(2);
  records.push(...history(2), ...[0, 1, 2].map(index => meal(4, index)));
  const result = getHealthInsights(records, 1850, now);
  assert.equal(result.daysWithEnoughMeals, 3);
  assert.equal(result.canCheckTrend, false);
});

test('three consecutive known low totals produce evidence against current app targets', () => {
  const result = getHealthInsights(history(3, 3, () => ({ eaten: { calories: 300, protein: 10, fiber: 2 } })), 1850, now);
  assert.equal(result.canCheckTrend, true);
  assert.deepEqual(ids(result), ['low-calories', 'low-protein', 'low-fiber']);
  assert.match(result.alerts[0].detail, /900 → 900 → 900/);
});

test('unknown, NaN and invalid nutrient values never become zero or trigger low nutrient claims', () => {
  for (const missing of [null, NaN, -1, undefined]) {
    const records = history(3, 3, () => ({ eaten: { calories: missing, protein: missing, fiber: missing } }));
    const result = getHealthInsights(records, 1850, now);
    assert.deepEqual(ids(result), []);
    assert.equal(result.unknownNutrientMeals, 9);
  }
  const partial = history(3, 3, () => ({ eaten: { calories: 300, protein: 10, fiber: 2 } }));
  partial[0].eaten.protein = null;
  assert.ok(!ids(getHealthInsights(partial, 1850, now)).includes('low-protein'));
});

test('declining portions and energy use chronological three-day evidence and a meaningful total drop', () => {
  const records = history(3, 3, day => ({ leftoverPercent: (3 - day) * 20, eaten: { calories: 300 + (day - 1) * 200, protein: 30, fiber: 10 } }));
  const result = getHealthInsights(records, 1850, now);
  const alert = result.alerts.find(item => item.id === 'declining-intake');
  assert.ok(alert);
  assert.match(alert.detail, /100 → 80 → 60%/);
  assert.match(alert.detail, /2100 → 1500 → 900/);
  const tiny = history(3, 3, day => ({ leftoverPercent: 3 - day }));
  assert.ok(!ids(getHealthInsights(tiny, 1850, now)).includes('declining-intake'));
});

test('repeated menu warning includes recipe variants but never counts untouched plates as eaten', () => {
  const records = history(3, 3, (day, index) => ({ referenceClass: 'Omelet', menu: index ? 'ไข่เจียวไข่ไก่' : 'ไข่เจียวไข่เป็ด' }));
  const result = getHealthInsights(records, 1850, now);
  assert.ok(ids(result).includes('repeated-menu'));
  assert.match(result.alerts[0].detail, /9 จาก 9 มื้อ/);
  assert.ok(!ids(getHealthInsights(records.map(item => ({ ...item, leftoverPercent: 100 })), 1850, now)).includes('repeated-menu'));
});

test('food group absence requires all seven days and user-confirmed groups; no automatic inference from menu', () => {
  const withoutFruit = groups.filter(group => group !== 'fruit');
  const records = history(7, 3, () => ({ foodGroups: withoutFruit }));
  const result = getHealthInsights(records, 1850, now);
  assert.equal(result.canCheckGroups, true);
  assert.match(result.alerts.find(alert => alert.id === 'missing-food-groups').detail, /ผลไม้/);
  records[0].foodGroupsConfirmed = false;
  const incomplete = getHealthInsights(records, 1850, now);
  assert.equal(incomplete.canCheckGroups, false);
  assert.ok(!ids(incomplete).includes('missing-food-groups'));
  const legacy = history(7, 3, () => ({ foodGroups: undefined, foodGroupsConfirmed: undefined }));
  assert.ok(!ids(getHealthInsights(legacy, 1850, now)).includes('missing-food-groups'));
});

test('an unconsumed fruit plate does not count as reported fruit intake', () => {
  const records = history(7, 3, () => ({ foodGroups: groups.filter(group => group !== 'fruit') }));
  records.push(meal(1, 3, { foodGroups: ['fruit'], leftoverPercent: 100 }));
  assert.match(getHealthInsights(records, 1850, now).alerts.find(alert => alert.id === 'missing-food-groups').detail, /ผลไม้/);
  records[records.length - 1].leftoverPercent = 0;
  assert.ok(!ids(getHealthInsights(records, 1850, now)).includes('missing-food-groups'));
});

test('balanced varied records do not show an alert or a diagnosis', () => {
  const result = getHealthInsights(history(7), 1850, now);
  assert.deepEqual(ids(result), []);
  assert.equal(result.canCheckGroups, true);
  assert.equal(result.daysWithEnoughMeals, 7);
});

test('food group confirmation survives stored analysis while malformed groups cannot be treated as confirmed', () => {
  const raw = { menu: 'ไข่เจียว', nutrition: { calories: 500 }, foodGroups: ['starch', 'protein'], foodGroupsConfirmed: true };
  const restored = nutrition.parseAnalysis(JSON.parse(JSON.stringify(nutrition.parseAnalysis(raw))));
  assert.equal(restored.foodGroupsConfirmed, true);
  assert.deepEqual(Array.from(restored.foodGroups), ['starch', 'protein']);
  for (const foodGroups of [[], ['unknown'], ['starch', 'unknown']]) {
    assert.notEqual(nutrition.parseAnalysis({ ...raw, foodGroups }).foodGroupsConfirmed, true);
  }
});

test('disabled food group feature never emits group warnings from existing confirmed history', () => {
  const disabled = load('src/utils/health-insights.ts', { '@/utils/nutrition': nutrition });
  const records = history(7, 3, () => ({ foodGroups: ['starch'] }));
  const result = disabled.getHealthInsights(records, 1850, now);
  assert.equal(result.canCheckGroups, false);
  assert.ok(!ids(result).includes('missing-food-groups'));
});
