const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const nutrition = load('src/utils/nutrition.ts', {}, { Error });
const groupSuggestions = load('src/utils/food-group-suggestions.ts', { '@/utils/nutrition': nutrition });

function harness({ pending = null, responses = [], picked = [], permissionGranted = true, canGoBack = true, reminderFailure = false } = {}) {
  const states = [], refs = [], saved = [], pendingWrites = [], uploads = [], imageUris = [], navigation = [], reminderCalls = [];
  let stateIndex = 0, refIndex = 0, first = true, tree;
  const walk = (node) => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children || []).flat(Infinity).flatMap(walk)];
  const text = (node) => typeof node === 'string' || typeof node === 'number' ? String(node) : [].concat(node?.props?.children || []).flat(Infinity).map(text).join('');
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback(fn) { return fn; }, useEffect(fn) { if (first) fn(); },
  };
  const Screen = load('src/app/scanner.tsx', {
    react,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Image: 'Image', Linking: {}, ScrollView: 'ScrollView', StyleSheet: { create: value => value }, Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: permissionGranted }, () => {}] },
    'expo-router': { useRouter: () => ({ canGoBack: () => canGoBack, back: () => navigation.push('back'), replace: path => navigation.push(path) }), useFocusEffect: fn => { if (first) fn(); } },
    '@/components/energy-bar': { __esModule: true, default: 'EnergyBar' },
    '@/components/leftover-slider': { __esModule: true, default: 'LeftoverSlider' },
    '@/services/food-api': { analyzeFood: async (uri, options) => { imageUris.push(uri); uploads.push(options); const next = responses.shift(); if (next instanceof Error) throw next; return next; }, checkFoodApiConnection: async () => {} },
    '@/services/test-photo-picker': { ENABLE_TEST_PHOTO_LIBRARY: true, pickTestPhotoUri: async () => { const next = picked.shift(); if (next instanceof Error) throw next; return next ?? null; } },
    '@/services/meal-reminders': { syncMealReminders: async request => { reminderCalls.push(request); if (reminderFailure) throw new Error('native scheduler unavailable'); return { supported: true, allowed: true, afterMeal: true }; } },
    '@/services/meal-storage': { getPendingMeal: async () => pending, savePendingMeal: async meal => pendingWrites.push(meal), finishMeal: async (meal, percent) => saved.push({ meal, percent }) },
    '@/utils/nutrition': nutrition,
    '@/utils/food-group-suggestions': groupSuggestions,
  }, { Error }).default;
  const render = () => { stateIndex = refIndex = 0; tree = Screen(); first = false; return tree; };
  const nodes = () => walk(tree);
  const button = label => nodes().find(node => node.type === 'TouchableOpacity' && text(node) === label);
  const press = async label => { const node = button(label); assert.ok(node, label); assert.ok(!node.props.disabled, `${label} should be enabled`); await node.props.onPress(); render(); };
  const readyCamera = () => { refs[0].current = { takePictureAsync: async () => ({ uri: 'file:///camera.jpg' }) }; nodes().find(node => node.type === 'CameraView').props.onCameraReady(); render(); };
  return { render, nodes, text: () => text(tree), button, press, readyCamera, saved, pendingWrites, uploads, imageUris, navigation, reminderCalls };
}
const analysis = grams => nutrition.parseAnalysis({ menu: 'ข้าว', nutrition: { calories: grams * 2 }, calibrated: true, comparisonReady: true, portions: [{ className: 'rice', grams, relativeArea: grams }] });
const tick = async h => { await new Promise(resolve => setImmediate(resolve)); h.render(); };

test('opening scanner directly uses the food log when there is no previous screen', async () => {
  for (const permissionGranted of [true, false]) {
    const h = harness({ canGoBack: false, permissionGranted });
    h.render(); await tick(h);
    await h.press(permissionGranted ? '← กลับ' : 'กลับ');
    assert.deepEqual(h.navigation, ['/food-log']);
  }
});

test('scanner results go back when possible and use a fallback after a direct opening', async () => {
  for (const canGoBack of [true, false]) {
    const h = harness({ pending: pendingMeal(), canGoBack });
    h.render(); await tick(h);
    await h.press('← กลับ');
    assert.deepEqual(h.navigation, [canGoBack ? 'back' : '/food-log']);
  }
});

test('canceling the after-meal camera stays on the existing meal without navigating', async () => {
  const h = harness({ pending: pendingMeal(), canGoBack: false });
  h.render(); await tick(h);
  await h.press('ถ่ายภาพหลังกิน');
  await h.press('← กลับ');
  assert.deepEqual(h.navigation, []);
  assert.ok(h.button('ถ่ายภาพหลังกิน'));
  assert.equal(h.pendingWrites.length, 0);
});

const pendingMeal = () => ({ ...analysis(200), nutritionBasis: 'fixed-serving', referenceClass: 'rice', servingLabel: '1 จาน', id: 'pending', createdAt: new Date().toISOString() });
const afterAnalysis = () => nutrition.parseAnalysis({ menu: 'rice', nutritionBasis: 'area-only', nutrition: {}, comparisonReady: true, portions: [{ className: 'rice', area: 50, relativeArea: 50 }] });
const takeAfter = async h => {
  await h.press('ถ่ายภาพหลังกิน'); h.readyCamera();
  await h.press('ถ่ายและใช้ภาพหลังกิน');
};

test('omelet recipe choice is required and selected nutrients remain the baseline after eating', async () => {
  const variants = [
    { id: 'duck-egg', label: 'ไข่เจียวไข่เป็ด', source: 'provided table page 1', nutrition: { calories: 305.38, carbs: 1.02, sugar: 0.62, protein: 10.61, fat: 28.76, fiber: 0.07 } },
    { id: 'chicken-egg', label: 'ไข่เจียวไข่ไก่', source: 'provided table page 2', nutrition: { calories: 264.77, carbs: 3.41, sugar: 1.92, protein: 12.55, fat: 22.33, fiber: 0.77 } },
  ];
  const result = nutrition.parseAnalysis({ ...pendingMeal(), menu: 'ไข่เจียว', nutrition: {}, nutritionVariants: variants });
  const h = harness({ responses: [result] });
  h.render(); await tick(h); h.readyCamera(); await h.press('ถ่ายรูปและวิเคราะห์อาหาร');
  assert.equal(h.button('บันทึกก่อนกิน / เริ่มกิน').props.disabled, true);
  h.nodes().find(node => node.props?.accessibilityLabel === 'ไข่เจียวไข่ไก่').props.onPress(); h.render();
  await h.press('บันทึกก่อนกิน / เริ่มกิน');
  assert.equal(h.pendingWrites[0].nutritionVariantId, 'chicken-egg');
  assert.equal(h.pendingWrites[0].nutrition.fat, 22.33);
  await takeAfter(h); await h.press('ปรับเปอร์เซ็นต์เอง');
  h.nodes().find(node => node.type === 'LeftoverSlider').props.onChange(25); h.render();
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].meal.nutrition.calories, 264.77);
  assert.equal(h.saved[0].meal.menu, 'ไข่เจียวไข่ไก่');
});

test('after photo is required and analysis is an explicit action preserving the original meal', async () => {
  const h = harness({ responses: [pendingMeal(), afterAnalysis()] });
  h.render(); await tick(h); h.readyCamera();
  await h.press('ถ่ายรูปและวิเคราะห์อาหาร');
  await h.press('บันทึกก่อนกิน / เริ่มกิน');
  assert.equal(h.button('ยืนยันและบันทึกผลหลังกิน').props.disabled, true);
  assert.equal(h.button('ปรับเปอร์เซ็นต์เอง'), undefined);
  await takeAfter(h);
  assert.equal(h.uploads.length, 1); // Capturing does not silently analyze or save.
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  assert.match(h.text(), /กินไป 75% · เหลือ 25%/);
  assert.equal(h.saved.length, 0);
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].percent, 25);
  assert.equal(h.saved[0].meal.nutrition.calories, 400);
  assert.equal(h.uploads[1].mode, 'after');
  assert.equal(h.uploads[1].menuClass, 'rice');
  assert.deepEqual(h.reminderCalls, [true, undefined]);
  assert.ok(h.pendingWrites[0].startedAt);
});

test('a notification failure never discards the meal that was already started', async () => {
  const h = harness({ responses: [pendingMeal()], reminderFailure: true });
  h.render(); await tick(h); h.readyCamera();
  await h.press('ถ่ายรูปและวิเคราะห์อาหาร'); await h.press('บันทึกก่อนกิน / เริ่มกิน');
  assert.equal(h.pendingWrites.length, 1);
  assert.ok(h.button('ถ่ายภาพหลังกิน'));
  assert.match(h.text(), /บันทึกมื้อแล้ว แต่ตั้งแจ้งเตือนไม่สำเร็จ/);
});

test('failed automatic analysis retains the photo and permits manual adjustment', async () => {
  const h = harness({ pending: pendingMeal(), responses: [new Error('ยังจับเมนูไม่ได้')] });
  h.render(); await tick(h); await takeAfter(h);
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  assert.match(h.text(), /ยังจับเมนูไม่ได้/);
  assert.equal(h.button('ยืนยันและบันทึกผลหลังกิน').props.disabled, true);
  await h.press('ปรับเปอร์เซ็นต์เอง');
  h.nodes().find(node => node.type === 'LeftoverSlider').props.onChange(25); h.render();
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].meal.id, 'pending');
  assert.equal(h.saved[0].percent, 25);
});

test('after eating can confirm a differently named detection while preserving the original recipe and nutrients', async () => {
  const before = { ...pendingMeal(), menu: 'ไข่เจียวไข่ไก่', nutritionVariantId: 'chicken-egg', referenceClass: 'Omelet', portions: [{ className: 'Omelet', area: 200, relativeArea: 200 }] };
  const candidate = { menu: 'Omelet', detectedMenu: 'ไข่ต้ม', confidence: 0.8, nutrition: {}, nutritionBasis: 'area-only', referenceClass: 'Omelet', comparisonReady: true, portions: [{ className: 'Omelet', area: 50, relativeArea: 50 }] };
  const response = nutrition.parseAnalysis({ menu: 'Omelet', nutrition: {}, nutritionBasis: 'area-only', needsMenuConfirmation: true, candidates: [candidate] });
  const h = harness({ pending: before, responses: [response] });
  h.render(); await tick(h); await takeAfter(h);
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  assert.match(h.text(), /ยืนยันว่าเป็นอาหารเดิม/);
  assert.equal(h.button('ยืนยันและบันทึกผลหลังกิน').props.disabled, true);
  const choice = h.nodes().find(node => node.props?.accessibilityLabel === 'ยืนยันพื้นที่ ไข่ต้ม เป็น ไข่เจียวไข่ไก่ ที่เหลือ');
  assert.ok(choice);
  await choice.props.onPress(); h.render();
  assert.match(h.text(), /กินไป 75% · เหลือ 25%/);
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].meal.menu, 'ไข่เจียวไข่ไก่');
  assert.equal(h.saved[0].meal.nutritionVariantId, 'chicken-egg');
  assert.equal(h.saved[0].meal.nutrition.calories, before.nutrition.calories);
  assert.equal(h.saved[0].percent, 25);
});

test('confirming the original food cannot bypass a missing spoon reference', async () => {
  const candidate = { ...afterAnalysis(), detectedMenu: 'ไข่ต้ม', confidence: 0.8, comparisonReady: false };
  const response = nutrition.parseAnalysis({ menu: 'rice', nutrition: {}, nutritionBasis: 'area-only', needsMenuConfirmation: true, candidates: [candidate] });
  const h = harness({ pending: pendingMeal(), responses: [response, new Error('ส่งภาพไม่สำเร็จ')] });
  h.render(); await tick(h); await takeAfter(h);
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  const choice = h.nodes().find(node => node.props?.accessibilityLabel === 'ยืนยันพื้นที่ ไข่ต้ม เป็น ข้าว ที่เหลือ');
  assert.ok(choice);
  await choice.props.onPress(); h.render();
  assert.match(h.text(), /ต้องเห็นช้อนอันเดิม/);
  assert.equal(h.button('ยืนยันและบันทึกผลหลังกิน').props.disabled, true);
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  assert.ok(!h.nodes().some(node => node.props?.accessibilityLabel === 'ยืนยันพื้นที่ ไข่ต้ม เป็น ข้าว ที่เหลือ'));
  await h.press('ปรับเปอร์เซ็นต์เอง');
  h.nodes().find(node => node.type === 'LeftoverSlider').props.onChange(25); h.render();
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].percent, 25);
});

test('no food detections do not become eaten-all until the user confirms an empty plate', async () => {
  const empty = nutrition.parseAnalysis({ menu: 'rice', nutrition: {}, nutritionBasis: 'area-only', emptyCandidate: true });
  const h = harness({ pending: pendingMeal(), responses: [empty] });
  h.render(); await tick(h); await takeAfter(h);
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  assert.match(h.text(), /ยังยืนยันว่าเป็นจานเปล่าไม่ได้/);
  assert.equal(h.button('ยืนยันและบันทึกผลหลังกิน').props.disabled, true);
  await h.press('จานเปล่า กินหมดแล้ว');
  assert.match(h.text(), /กินหมดแล้ว · กินไป 100% · เหลือ 0%/);
  assert.ok(!h.nodes().some(node => node.type === 'LeftoverSlider'));
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].percent, 0);
});

test('legacy meals can complete after an empty-plate photo without requiring a spoon baseline', async () => {
  const h = harness({ pending: { menu: 'ข้าว', nutrition: analysis(200).nutrition, id: 'legacy', createdAt: new Date().toISOString() } });
  h.render(); await tick(h); await takeAfter(h);
  await h.press('จานเปล่า กินหมดแล้ว');
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].meal.id, 'legacy');
  assert.equal(h.saved[0].percent, 0);
});

test('library images remain usable for before and required after photos without camera permission', async () => {
  const h = harness({ permissionGranted: false, picked: ['file:///before.jpg', null, 'file:///after.jpg'], responses: [pendingMeal(), afterAnalysis()] });
  h.render(); await tick(h);
  await h.press('เลือกรูปจากคลังภาพ (ทดสอบ)');
  assert.equal(h.uploads.length, 0);
  await h.press('เลือกรูปจากคลังภาพ (ทดสอบ)');
  await h.press('วิเคราะห์รูปที่เลือก');
  await h.press('บันทึกก่อนกิน / เริ่มกิน');
  await h.press('ถ่ายภาพหลังกิน');
  await h.press('เลือกรูปจากคลังภาพ (ทดสอบ)');
  await h.press('ใช้รูปนี้เป็นภาพหลังกิน');
  assert.equal(h.uploads.length, 1);
  await h.press('ให้แอปวิเคราะห์อาหารที่เหลือ');
  assert.equal(h.imageUris[1], 'file:///after.jpg');
  assert.match(h.text(), /กินไป 75% · เหลือ 25%/);
});

test('candidate selection is required and replaces nutrition and area with the selected menu', async () => {
  const base = pendingMeal();
  const detectedFoods = [
    { className: 'Rice', label: 'ข้าวสวย', confidence: 0.9 },
    { className: 'Omelet', label: 'ไข่เจียว', confidence: 0.8 },
  ];
  const candidates = [
    { ...base, menu: 'เมนูหนึ่ง', confidence: 0.8 },
    { ...base, menu: 'เมนูสอง', referenceClass: 'second', nutrition: { ...base.nutrition, calories: 800 }, portions: [{ className: 'second', area: 100, relativeArea: 1 }], confidence: 0.6 },
    { ...base, menu: 'เมนูสาม', referenceClass: 'third', confidence: 0.3 },
  ];
  const h = harness({ responses: [{ ...base, candidates, detectedFoods }] });
  h.render(); await tick(h); h.readyCamera();
  await h.press('ถ่ายรูปและวิเคราะห์อาหาร');
  assert.match(h.text(), /อาหารที่ตรวจพบในภาพก่อนกิน/);
  assert.match(h.text(), /ข้าวสวย/);
  assert.match(h.text(), /ไข่เจียว/);
  assert.equal(h.button('บันทึกก่อนกิน / เริ่มกิน').props.disabled, true);
  const choices = h.nodes().filter(node => node.props?.accessibilityRole === 'radio');
  assert.equal(choices.length, 3);
  choices[1].props.onPress(); h.render();
  await h.press('บันทึกก่อนกิน / เริ่มกิน');
  assert.equal(h.pendingWrites[0].menu, 'เมนูสอง');
  assert.equal(h.pendingWrites[0].nutrition.calories, 800);
  assert.equal(h.pendingWrites[0].portions[0].className, 'second');
  assert.deepEqual(h.pendingWrites[0].detectedFoods, detectedFoods);
});

test('food group controls and automatic suggestions are disabled while normal meal logging remains usable', async () => {
  const h = harness({ responses: [pendingMeal()] });
  h.render(); await tick(h); h.readyCamera();
  await h.press('ถ่ายรูปและวิเคราะห์อาหาร');
  assert.ok(!h.nodes().some(node => node.props?.accessibilityRole === 'checkbox'));
  assert.ok(!h.button('ยืนยันหมู่อาหารที่เลือก'));
  await h.press('บันทึกก่อนกิน / เริ่มกิน');
  assert.equal(h.pendingWrites[0].foodGroups, undefined);
  assert.equal(h.pendingWrites[0].foodGroupsConfirmed, undefined);
  await takeAfter(h);
  await h.press('ปรับเปอร์เซ็นต์เอง');
  h.nodes().find(node => node.type === 'LeftoverSlider').props.onChange(25); h.render();
  await h.press('ยืนยันและบันทึกผลหลังกิน');
  assert.equal(h.saved[0].percent, 25);
});
