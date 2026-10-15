const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');

function harness(failure = false) {
  const states = [], deleted = [], navigation = [];
  let index = 0, first = true, tree;
  const react = { useState(initial) { const n = index++; if (!(n in states)) states[n] = initial; return [states[n], value => { states[n] = typeof value === 'function' ? value(states[n]) : value; }]; }, useCallback: fn => fn };
  const Screen = load('src/app/settings.tsx', {
    react,
    'expo-router': { useRouter: () => ({ replace: path => navigation.push(path), push() {} }), useFocusEffect: effect => { if (first) effect(); } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Platform: { OS: 'web' }, ScrollView: 'ScrollView', Switch: 'Switch', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View' },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null } },
    '@/components/design-system': { BottomNav: 'BottomNav', Button: 'Button', Card: 'Card', Field: 'Field', Icon: 'Icon', Message: 'Message', Progress: 'Progress', Screen: 'Screen', palette: {}, ui: {} },
    '@/services/profile-storage': { getProfile: async () => null, userKey: async key => key },
    '@/utils/profile-metrics': { profileMetrics: () => ({ energy: null }) },
    '@/hooks/use-health-data': { useHealthData: () => ({ profile: null, goal: 1850, totals: { calories: 0 } }) },
    '@/services/meal-reminders': { getReminderPreferences: async () => ({ meals: false, afterMeal: true }), saveReminderPreferences: async () => {} },
    '@/hooks/use-auth': { useAuth: () => ({ session: { email: 'owner@example.test' }, deleteAccount: async password => { if (failure) throw new Error('รหัสผ่านไม่ถูกต้อง'); deleted.push(password); } }) },
  }, { Error }).default;
  const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children || []).flat(Infinity).flatMap(walk)];
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : [].concat(node?.props?.children || []).flat(Infinity).map(text).join('');
  const render = () => { index = 0; tree = Screen(); first = false; };
  const nodes = () => walk(tree);
  const find = label => nodes().find(node => node.props?.accessibilityLabel === label || (node.type === 'TouchableOpacity' && text(node) === label));
  const press = async label => { const node = find(label); assert.ok(node, label); assert.ok(!node.props.disabled); await node.props.onPress(); render(); };
  const password = value => { nodes().find(node => node.props?.label === 'รหัสผ่านปัจจุบัน').props.onChangeText(value); render(); };
  return { render, nodes, find, press, password, deleted, navigation, text: () => text(tree) };
}

test('settings deletion requires both current password and explicit confirmation; cancel does nothing', async () => {
  const h = harness(); h.render(); await h.press('ลบบัญชี');
  assert.match(h.text(), /owner@example.test/);
  assert.match(h.text(), /ไม่ใช่เฉพาะรายชื่อผู้สูงอายุ/);
  assert.equal(h.find('ยืนยันลบบัญชีถาวร').props.disabled, true);
  h.password('test-password');
  assert.equal(h.find('ยืนยันลบบัญชีถาวร').props.disabled, true);
  await h.press('ฉันยืนยันลบบัญชีนี้ถาวร');
  assert.equal(h.find('ยืนยันลบบัญชีถาวร').props.disabled, false);
  await h.press('ยกเลิก');
  assert.equal(h.deleted.length, 0);
  await h.press('ลบบัญชี');
  assert.equal(h.find('ยืนยันลบบัญชีถาวร').props.disabled, true);
});

test('confirmed successful deletion returns to login, failure remains in the dialog for correction', async () => {
  for (const failure of [false, true]) {
    const h = harness(failure); h.render(); await h.press('ลบบัญชี');
    h.password('test-password'); await h.press('ฉันยืนยันลบบัญชีนี้ถาวร');
    await h.press('ยืนยันลบบัญชีถาวร');
    if (failure) {
      assert.deepEqual(h.navigation, []); assert.equal(h.deleted.length, 0);
      assert.ok(h.nodes().some(node => node.type === 'Message' && node.props.text === 'รหัสผ่านไม่ถูกต้อง'));
    } else { assert.deepEqual(h.deleted, ['test-password']); assert.deepEqual(h.navigation, ['/']); }
  }
});
