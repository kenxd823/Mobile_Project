const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const metrics = load('src/utils/profile-metrics.ts');
const nutrition = load('src/utils/nutrition.ts');

function setup() {
  const values = new Map([['userEmail', 'caregiver@example.test']]);
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const mocks = { '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, '@/utils/profile-metrics': metrics, '@/utils/nutrition': nutrition };
  return { values, profiles: load('src/services/profile-storage.ts', mocks), meals: load('src/services/meal-storage.ts', mocks) };
}
const profile = (name, weight) => ({ firstName: name, lastName: 'Test', phone: '0000000000', gender: 'หญิง', dob: '01/01/1940', weight: String(weight), height: '160', diseases: ['เบาหวาน'] });
const meal = id => ({ ...nutrition.parseAnalysis({ menu: 'ข้าว', nutrition: { calories: 500 } }), id, createdAt: new Date().toISOString() });

test('caregiver records retain the full elderly form, edits update the same selected person', async () => {
  const { profiles } = setup();
  await profiles.saveProfile(profile('Caregiver', 70), 'caregiver');
  const a = await profiles.savePatient(profile('A', 60));
  const b = await profiles.savePatient(profile('B', 80));
  assert.notEqual(a.id, b.id);
  await profiles.selectPatient(a.id);
  const selected = await profiles.getProfile();
  assert.equal(selected.firstName, 'A');
  assert.equal(selected.weight, '60');
  assert.equal(selected.dob, '01/01/1940');
  assert.equal(selected.diseases[0], 'เบาหวาน');
  assert.equal(await profiles.getEnergyGoal(), 1200);
  await profiles.saveProfile({ ...selected, weight: '65', firstName: 'A updated' });
  assert.equal((await profiles.getPatients()).length, 2);
  assert.equal((await profiles.getProfile()).firstName, 'A updated');
  assert.equal(await profiles.getEnergyGoal(), 1300);
  assert.equal((await profiles.getProfile('caregiver')).firstName, 'Caregiver');
  assert.equal((await profiles.getProfile('elderly', b.id)).weight, '80');
  assert.equal(await profiles.getActivePatientId(), a.id);
});

test('goals, pending meals, histories and deletion recovery are isolated for each elderly person', async () => {
  const { profiles, meals } = setup();
  const a = await profiles.savePatient(profile('A', 60));
  const b = await profiles.savePatient(profile('B', 80));
  await profiles.selectPatient(a.id);
  await profiles.saveEnergyGoal(1400);
  await meals.savePendingMeal(meal('a-meal'));
  await profiles.selectPatient(b.id);
  assert.equal(await meals.getPendingMeal(), null);
  assert.equal((await meals.getMealHistory()).length, 0);
  assert.equal(await profiles.getEnergyGoal(), 1600);
  await meals.finishMeal(meal('b-meal'), 50);
  await profiles.selectPatient(a.id);
  assert.equal((await meals.getPendingMeal()).id, 'a-meal');
  assert.equal(await profiles.getEnergyGoal(), 1200);
  await meals.finishMeal(await meals.getPendingMeal(), 0);
  assert.equal((await meals.getMealHistory())[0].id, 'a-meal');
  assert.equal((await meals.getMealHistory(b.id))[0].id, 'b-meal');
  assert.equal(await profiles.getEnergyGoal(b.id), 1600);
  await meals.deleteTodayMeal('a-meal');
  await profiles.selectPatient(b.id);
  await assert.rejects(meals.restoreDeletedMeal('a-meal'), /ไม่พบ/);
  assert.equal((await meals.getMealHistory())[0].id, 'b-meal');
  await profiles.selectPatient(a.id);
  await meals.restoreDeletedMeal('a-meal');
  assert.equal((await meals.getMealHistory())[0].id, 'a-meal');
});

test('old personal profiles and meals are preserved without being copied to a new patient', async () => {
  const { profiles, meals } = setup();
  await profiles.saveProfile(profile('Old personal', 55));
  await meals.finishMeal(meal('old-personal-meal'), 0);
  await profiles.saveEnergyGoal(1700);
  await profiles.savePatients([{ id: 'legacy', firstName: 'Legacy', lastName: 'Record', phone: '', gender: 'ชาย' }]);
  await profiles.selectPatient('legacy');
  assert.equal((await profiles.getProfile()).dob, '');
  assert.equal((await profiles.getProfile()).diseases.length, 0);
  assert.equal((await meals.getMealHistory()).length, 0);
  assert.equal(await profiles.getEnergyGoal(), 1850);
  assert.equal((await profiles.getPersonalProfile()).firstName, 'Old personal');
  await profiles.selectPatient(null);
  assert.equal((await profiles.getProfile()).firstName, 'Old personal');
  assert.equal((await meals.getMealHistory())[0].id, 'old-personal-meal');
  assert.equal(await profiles.getEnergyGoal(), 1100);
});

test('patient names and selections remain scoped to the signed-in account', async () => {
  const { profiles, values, meals } = setup();
  const a = await profiles.savePatient(profile('A', 60));
  await profiles.selectPatient(a.id);
  await meals.finishMeal(meal('private-meal'), 0);
  values.set('userEmail', 'other@example.test');
  assert.equal((await profiles.getPatients()).length, 0);
  assert.equal(await profiles.getActivePatientId(), null);
  assert.equal((await meals.getMealHistory()).length, 0);
  await assert.rejects(profiles.selectPatient(a.id), /ไม่พบ/);
  values.set('userEmail', 'caregiver@example.test');
  assert.equal(await profiles.getActivePatientId(), a.id);
  assert.equal((await meals.getMealHistory())[0].id, 'private-meal');
});
