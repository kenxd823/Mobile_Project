const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const metrics = load('src/utils/profile-metrics.ts');

function harness(file, services, props = {}, canDismiss = true) {
  const state = [], navigation = [], roles = [];
  let index = 0, first = true, tree;
  const react = {
    useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value; }]; },
    useEffect(effect) { if (first) effect(); }, useCallback: fn => fn,
  };
  const Screen = load(file, {
    react,
    'react-native': { Text: 'Text', View: 'View', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator' },
    'expo-router': { useRouter: () => ({ replace: path => navigation.push(path), canDismiss: () => canDismiss, dismissAll: () => { assert.ok(canDismiss, 'cannot pop a stack without prior screens'); navigation.push('dismissAll'); } }), useFocusEffect: effect => { if (first) effect(); } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { setItem: async (...args) => roles.push(args) } },
    './design-system': { Button: 'Button', Field: 'Field', Icon: 'Icon', Logo: 'Logo', Message: 'Message', Screen: 'Screen', Select: 'Select', ui: {}, palette: {} },
    '@/components/design-system': { Button: 'Button', Icon: 'Icon', Logo: 'Logo', Message: 'Message', Screen: 'Screen', ui: {}, palette: {} },
    '@/hooks/use-auth': { useAuth: () => ({ signOut: async () => {} }) },
    '@/services/profile-storage': services,
    '@/utils/profile-metrics': metrics,
  }, { Error }).default;
  const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children || []).flat(Infinity).flatMap(walk)];
  const render = () => { index = 0; tree = Screen(props); first = false; };
  const nodes = () => walk(tree);
  const field = label => nodes().find(node => node.props?.label === label);
  const press = async label => {
    const node = nodes().find(node => node.props?.title === label || node.props?.accessibilityLabel === label);
    assert.ok(node, label); assert.ok(!node.props.disabled && !node.props.loading);
    await node.props.onPress(); render();
  };
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  return { render, nodes, field, press, settle, navigation, roles };
}

const emptyProfile = { firstName: '', lastName: '', dob: '', phone: '', gender: '', weight: '', height: '', diseases: [] };

test('choosing the elderly role opens the caregiver-created name list instead of a new profile form', async () => {
  const h = harness('src/app/select-role.tsx', { getProfile: async () => { throw new Error('elderly role must choose a name first'); } });
  h.render();
  h.nodes().filter(node => node.props?.accessibilityRole === 'radio')[1].props.onPress(); h.render();
  await h.press('ตกลง');
  assert.deepEqual(h.navigation, ['/select-elderly']);
  assert.deepEqual(h.roles, [['userRole', 'elderly']]);
});
test('adding a caregiver patient uses all elderly profile fields and saves a separate full record', async () => {
  const saved = [];
  const h = harness('src/components/profile-form.tsx', {
    emptyProfile, getPatients: async () => [],
    getProfile: async () => { throw new Error('new patient must not copy the previously selected profile'); },
    savePatient: async profile => saved.push(profile), saveProfile: async () => { throw new Error('must not replace a personal profile'); },
  }, { patient: true });
  h.render(); await h.settle();
  for (const [label, value] of [
    ['ชื่อ', 'Test'], ['นามสกุล', 'Elder'], ['วัน/เดือน/ปี เกิด (พ.ศ. หรือ ค.ศ.)', '01/01/2483'],
    ['เบอร์โทรศัพท์', '0000000000'], ['น้ำหนัก (กิโลกรัม)', '60'], ['ส่วนสูง (เซนติเมตร)', '160'],
  ]) { h.field(label).props.onChangeText(value); h.render(); }
  h.field('เพศกำเนิด').props.onChange('หญิง'); h.render();
  h.nodes().find(node => node.props?.accessibilityLabel === 'เบาหวาน').props.onPress(); h.render();
  await h.press('บันทึกรายชื่อ');
  assert.equal(saved[0].weight, '60'); assert.equal(saved[0].height, '160');
  assert.equal(saved[0].dob, '01/01/2483'); assert.equal(saved[0].diseases[0], 'เบาหวาน');
  assert.deepEqual(h.navigation, ['/caregiver-home']);
});

test('selecting a caregiver-created name sets elderly mode and clears old screens before opening home', async () => {
  const selected = [];
  const h = harness('src/app/select-elderly.tsx', {
    getPatients: async () => [{ id: 'p1', firstName: 'Test', lastName: 'Elder', gender: 'หญิง', phone: '' }],
    getPersonalProfile: async () => null, selectPatient: async id => selected.push(id),
  });
  h.render(); await h.settle();
  await h.press('เลือก Test Elder');
  assert.deepEqual(selected, ['p1']);
  assert.deepEqual(h.roles, [['userRole', 'elderly']]);
  assert.deepEqual(h.navigation, ['dismissAll', '/elderly-home']);
});

test('failed patient selection cannot open home or change the role', async () => {
  const h = harness('src/app/select-elderly.tsx', {
    getPatients: async () => [{ id: 'p1', firstName: 'Test', lastName: 'Elder' }],
    getPersonalProfile: async () => null, selectPatient: async () => { throw new Error('save failed'); },
  });
  h.render(); await h.settle(); await h.press('เลือก Test Elder');
  assert.deepEqual(h.navigation, []); assert.deepEqual(h.roles, []);
  assert.equal(h.nodes().find(node => node.type === 'Message').props.text, 'save failed');
});

test('selecting a name from the first screen opens home without an unhandled POP_TO_TOP', async () => {
  const selected = [];
  const h = harness('src/app/select-elderly.tsx', {
    getPatients: async () => [{ id: 'p1', firstName: 'Test', lastName: 'Elder' }],
    getPersonalProfile: async () => null, selectPatient: async id => selected.push(id),
  }, {}, false);
  h.render(); await h.settle(); await h.press('เลือก Test Elder');
  assert.deepEqual(selected, ['p1']);
  assert.deepEqual(h.roles, [['userRole', 'elderly']]);
  assert.deepEqual(h.navigation, ['/elderly-home']);
  assert.equal(h.nodes().find(node => node.type === 'Message').props.text, '');
});
