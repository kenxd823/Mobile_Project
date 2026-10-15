const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const nutrition = load('src/utils/nutrition.ts');
const { suggestFoodGroups } = load('src/utils/food-group-suggestions.ts', { '@/utils/nutrition': nutrition });
const suggest = input => Array.from(suggestFoodGroups({ menu: 'เมนูทดสอบ', nutrition: {}, ...input }));

test('rice and omelet detections suggest combined groups once in display order', () => {
  assert.deepEqual(suggest({ referenceClass: 'Omelet', detectedFoods: [
    { className: 'Rice', confidence: 0.9 },
    { className: 'Omelet', confidence: 0.8 },
  ] }), ['starch', 'protein', 'fat']);
});

test('main menu uses class identity rather than a recipe label and ignores alternative menu guesses', () => {
  assert.deepEqual(suggest({ menu: 'ไข่เจียวไข่ไก่', referenceClass: 'Omelet', candidates: [{ referenceClass: 'Rice' }] }), ['protein', 'fat']);
  assert.deepEqual(suggest({ referenceClass: 'khai tom' }), ['protein']);
});

test('weak secondary detections and unknown classes do not invent groups or fruit ingredients', () => {
  assert.deepEqual(suggest({ referenceClass: 'Omelet', detectedFoods: [{ className: 'Rice', confidence: 0.1 }] }), ['protein', 'fat']);
  assert.deepEqual(suggest({ referenceClass: 'unknown' }), []);
  assert.ok(!suggest({ referenceClass: 'PadPreawWan' }).includes('fruit'));
});

test('older class casing and portion metadata remain usable without retroactively confirming groups', () => {
  const analysis = { menu: 'ข้าว', nutrition: {}, portions: [{ className: 'rice' }] };
  assert.deepEqual(Array.from(suggestFoodGroups(analysis)), ['starch']);
  assert.equal(analysis.foodGroupsConfirmed, undefined);
  assert.equal(analysis.foodGroups, undefined);
});
