const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const { NUTRIENTS, splitNutrition, parseAnalysis, estimateLeftover } = load('src/utils/nutrition.ts');
const nutrition = Object.fromEntries(NUTRIENTS.map(({ key }) => [key, key === 'sodium' ? 800 : 100]));

test('per-plate display has energy plus five nutrients and excludes saturated fat and sodium', () => {
  const { DISPLAY_NUTRIENTS, PLATE_NUTRIENTS } = load('src/utils/nutrition.ts');
  assert.equal(DISPLAY_NUTRIENTS.length, 6);
  assert.equal(PLATE_NUTRIENTS.length, 5);
  assert.ok(!DISPLAY_NUTRIENTS.some(({ key }) => key === 'sodium' || key === 'saturatedFat'));
});

for (const percent of [0, 1, 25, 50, 75, 99, 100]) {
  test(`remaining ${percent}%: all eight nutrients conserve totals`, () => {
    const { eaten, remaining } = splitNutrition(nutrition, percent);
    assert.equal(Object.keys(eaten).length, 8);
    for (const { key } of NUTRIENTS) {
      assert.equal(eaten[key], nutrition[key] * (100 - percent) / 100);
      assert.equal(remaining[key], nutrition[key] * percent / 100);
      assert.ok(Math.abs(eaten[key] + remaining[key] - nutrition[key]) < 1e-8);
    }
  });
}
test('unknown nutrients stay unknown, zero is known, invalid values rejected', () => {
  const parsed = parseAnalysis({ menu: 'ข้าว', nutrition: { calories: 500, protein: 0, sugar: -1, sodium: Infinity } });
  assert.equal(parsed.nutrition.protein, 0);
  assert.equal(parsed.nutrition.sugar, null);
  assert.equal(parsed.nutrition.sodium, null);
  const split = splitNutrition(parsed.nutrition, 25);
  assert.equal(split.eaten.calories, 375);
  assert.equal(split.remaining.calories, 125);
  assert.equal(split.eaten.fat, null);
  assert.throws(() => parseAnalysis({ menu: '', nutrition }));
  assert.throws(() => parseAnalysis({ menu: 'ข้าว', nutrition: {} }));
});
test('out-of-range percentages cannot produce negative nutrients', () => {
  assert.equal(splitNutrition(nutrition, -1).eaten.calories, 100);
  assert.equal(splitNutrition(nutrition, 101).eaten.calories, 0);
  assert.equal(splitNutrition(nutrition, NaN).eaten.calories, 0);
});

test('fixed reference placeholders can retain area without inventing nutrient values', () => {
  const pending = parseAnalysis({ menu: 'ข้าวต้มปลา', nutritionBasis: 'fixed-serving', nutrition: {}, servingLabel: '1 ชาม', source: null, referenceClass: 'Boiled rice fish', comparisonReady: true, portions: [{ className: 'Boiled rice fish', area: 400, relativeArea: 4 }] });
  assert.equal(pending.nutrition.calories, null);
  assert.equal(pending.servingLabel, '1 ชาม');
  assert.equal(pending.referenceClass, 'Boiled rice fish');
  const after = parseAnalysis({ menu: 'Boiled rice fish', nutritionBasis: 'area-only', nutrition: {}, comparisonReady: true, portions: [{ className: 'Boiled rice fish', area: 100, relativeArea: 1 }] });
  assert.equal(estimateLeftover(pending, after), 25);
  assert.equal(splitNutrition(pending.nutrition, 25).eaten.calories, null);
});

test('photo comparison uses spoon-normalized area, permits fully eaten components, and conserves nutrients', () => {
  const before = parseAnalysis({ menu: 'ข้าว ไข่', nutrition, calibrated: true, comparisonReady: true, portions: [{ className: 'rice', grams: 200, relativeArea: 200 }, { className: 'egg', grams: 100, relativeArea: 100 }] });
  const after = parseAnalysis({ menu: 'ข้าว', nutrition, calibrated: true, comparisonReady: true, portions: [{ className: 'rice', grams: 999, relativeArea: 150 }] });
  const percent = estimateLeftover(before, after);
  assert.equal(percent, 50);
  assert.equal(splitNutrition(before.nutrition, percent).eaten.calories, 50);
  assert.equal(estimateLeftover(before, before), 100);
});

test('unmatched menus, missing scale, invalid weights, and larger after portions require manual review', () => {
  const before = { menu: 'ข้าว', nutrition, calibrated: true, comparisonReady: true, portions: [{ className: 'rice', grams: 100, relativeArea: 100 }] };
  assert.throws(() => estimateLeftover({ ...before, comparisonReady: false }, before), /ช้อนอันเดิม/);
  assert.throws(() => estimateLeftover(before, { ...before, comparisonReady: false }), /ช้อนอันเดิม/);
  assert.throws(() => estimateLeftover(before, { ...before, portions: [{ className: 'noodles', grams: 50, relativeArea: 50 }] }), /เมนูหลังกินไม่ตรง/);
  assert.throws(() => estimateLeftover(before, { ...before, portions: [{ className: 'rice', grams: 120, relativeArea: 120 }] }), /ปริมาณหลังกินมากกว่า/);
  const invalid = parseAnalysis({ menu: 'ข้าว', nutrition, calibrated: true, comparisonReady: true, portions: [{ className: 'rice', grams: Infinity }] });
  assert.throws(() => estimateLeftover(before, invalid), /ช้อนอันเดิม/);
  assert.throws(() => estimateLeftover(before, { menu: 'ข้าว', nutrition }), /ช้อนอันเดิม/);
});
