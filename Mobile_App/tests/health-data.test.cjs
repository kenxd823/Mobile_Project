const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const nutrition = load('src/utils/nutrition.ts');
const { totalNutrition, dayKey } = load('src/hooks/use-health-data.ts', {
  'expo-router': {}, '@/services/profile-storage': {}, '@/services/meal-storage': {}, '@/utils/nutrition': nutrition,
});

test('home and dashboard use eaten nutrients rather than the entire plate', () => {
  const plate = nutrition.parseAnalysis({ menu: 'ข้าว', nutrition: { calories: 500, protein: 20, carbs: 60, sugar: 0 } });
  const first = nutrition.splitNutrition(plate.nutrition, 25);
  const second = nutrition.splitNutrition(plate.nutrition, 50);
  const totals = totalNutrition([{ eaten: first.eaten }, { eaten: second.eaten }]);
  assert.equal(totals.calories, 625);
  assert.equal(totals.protein, 25);
  assert.equal(totals.carbs, 75);
  assert.equal(totals.sugar, 0);
  assert.equal(totals.fiber, null);
});
test('unknown nutrients remain unknown across mixed meals', () => {
  const a = Object.fromEntries(nutrition.NUTRIENTS.map(({ key }) => [key, 10]));
  const b = { ...a, sodium: null };
  const totals = totalNutrition([{ eaten: a }, { eaten: b }]);
  assert.equal(totals.calories, 20);
  assert.equal(totals.sodium, null);
  assert.equal(totalNutrition([]).calories, 0);
});
test('day keys use local calendar dates for meal grouping', () => {
  assert.equal(dayKey(new Date(2026, 9, 12, 23, 59)), '2026-9-12');
  assert.notEqual(dayKey(new Date(2026, 9, 13, 0, 1)), '2026-9-12');
});
