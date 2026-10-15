const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const metrics = load('src/utils/profile-metrics.ts', {}, { Date });
const today = new Date(2026, 9, 14);
const profile = (dob, weight = '60', height = '160') => ({ dob, weight, height });

test('elderly energy uses exact age boundaries and completed birthdays', () => {
  for (const [dob, age, energy] of [
    ['15/10/1966', 59, null], ['14/10/1966', 60, 1500],
    ['14/10/1946', 80, 1500], ['15/10/1945', 80, 1500], ['14/10/1945', 81, 1200],
  ]) {
    const actual = metrics.profileMetrics(profile(dob), today);
    assert.equal(actual.age, age);
    assert.equal(actual.energy, energy);
  }
});

test('Thai Buddhist Era dates and Common Era dates produce the same age and energy', () => {
  assert.deepEqual(metrics.profileMetrics(profile('14/10/2509'), today), metrics.profileMetrics(profile('14/10/1966'), today));
});

test('BMI uses height in meters and is separate from the age-based energy formula', () => {
  const actual = metrics.profileMetrics(profile('14/10/1945', '60', '160'), today);
  assert.equal(actual.bmi, 23.437499999999996);
  assert.equal(actual.energy, 1200);
  assert.equal(metrics.profileMetrics(profile('14/10/1945', '60', ''), today).energy, 1200);
});

test('invalid or missing measurements cannot invent age, BMI, or calculated energy', () => {
  for (const dob of ['', '31/02/1960', '29/02/1961', '14/10/2027', 'not a date']) {
    assert.equal(metrics.ageFromDob(dob, today), null);
    assert.equal(metrics.profileMetrics(profile(dob), today).energy, null);
  }
  assert.equal(metrics.ageFromDob('29/02/1960', today), 66);
  for (const weight of ['', '0', '-1', 'Infinity', 'abc']) {
    const actual = metrics.profileMetrics(profile('14/10/1945', weight), today);
    assert.equal(actual.energy, null);
    assert.equal(actual.bmi, null);
  }
  assert.equal(metrics.profileMetrics(null, today).energy, null);
});

test('elderly goal always follows age and weight; younger users may set their goal without an elderly formula', async () => {
  const data = new Map([['userEmail', 'elderly@example.test']]);
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key) };
  const api = load('src/services/profile-storage.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    '@/utils/profile-metrics': metrics,
  });
  const initial = { ...profile('01/01/1940'), firstName: 'Test', lastName: 'Test', phone: '', gender: '', diseases: [] };
  await api.saveProfile(initial);
  assert.equal(await api.getEnergyGoal(), 1200);
  await api.saveProfile({ ...initial, weight: '65' });
  assert.equal(await api.getEnergyGoal(), 1300);
  await api.saveEnergyGoal(1600);
  assert.equal(await api.getEnergyGoal(), 1300);
  await api.resetEnergyGoal();
  assert.equal(await api.getEnergyGoal(), 1300);
  await api.saveProfile({ ...initial, dob: '01/01/2000' });
  await api.saveEnergyGoal(1700);
  assert.equal(await api.getEnergyGoal(), 1700);
  await storage.setItem('userEmail', 'other@example.test');
  assert.equal(await api.getEnergyGoal(), 1850);
});
