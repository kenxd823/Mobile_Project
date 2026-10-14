const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');
const nutrition = load('src/utils/nutrition.ts');
class CameraFile {
  constructor(uri) { this.uri = uri; }
  exists = true;
  size = 4;
  name = 'camera.jpg';
  type = 'image/jpeg';
  async bytes() { return new Uint8Array([255, 216, 255, 217]); }
}
function api({ os = 'android', host = '192.168.1.12:8081', env = {}, fetch, ...globals } = {}) {
  return load('src/services/food-api.ts', {
    'expo-constants': { __esModule: true, default: { expoConfig: { hostUri: host } } },
    'react-native': { Platform: { OS: os } },
    'expo/fetch': { fetch },
    'expo-file-system': { File: globals.CameraFile ?? CameraFile },
    '@/utils/nutrition': nutrition,
  }, { process: { env }, fetch, ...globals });
}
test('uses Expo LAN host, explicit override, and rejects tunnel without API URL', () => {
  assert.equal(api().getFoodApiUrl(), 'http://192.168.1.12:5000');
  assert.equal(api({ env: { EXPO_PUBLIC_FOOD_API_URL: 'https://food.example.com/' } }).getFoodApiUrl(), 'https://food.example.com');
  assert.throws(() => api({ host: 'test.exp.direct' }).getFoodApiUrl());
});
test('web submits multipart Blob and lets fetch choose the boundary', async () => {
  let submitted;
  const client = api({ os: 'web', fetch: async (url, options) => {
    if (url === 'data:image/jpeg;base64,test') return { blob: async () => new Blob(['jpeg'], { type: 'image/jpeg' }) };
    submitted = options;
    assert.equal(url, 'http://192.168.1.12:5000/api/analyze');
    return { ok: true, json: async () => ({ status: 'success', menu: 'ข้าว', nutrition: { calories: 500 } }) };
  } });
  const result = await client.analyzeFood('data:image/jpeg;base64,test');
  assert.equal(result.nutrition.calories, 500);
  assert.equal(submitted.headers, undefined);
  assert.equal(submitted.body.get('image').type, 'image/jpeg');
});
test('native upload is compatible with the installed SDK 57 multipart encoder', async () => {
  const { convertFormDataAsync } = load('node_modules/expo/src/winter/fetch/convertFormData.ts', {
    '../../utils/blobUtils': { blobToArrayBufferAsync: (blob) => blob.arrayBuffer() },
  }, { TextEncoder });
  class NativeFormData {
    parts = [];
    append(name, value) { this.parts.push([name, value]); }
    entries() { return this.parts; }
  }
  const legacy = new NativeFormData();
  legacy.append('image', { uri: 'file:///food.jpg', name: 'food.jpg', type: 'image/jpeg' });
  await assert.rejects(convertFormDataAsync(legacy), /Unsupported FormDataPart/);
  const client = api({ FormData: NativeFormData, fetch: async (_url, options) => {
    const { body } = await convertFormDataAsync(options.body, 'test-boundary');
    const encoded = Buffer.from(body);
    assert.match(encoded.toString('latin1'), /name="image"; filename="camera.jpg"/);
    assert.match(encoded.toString('latin1'), /content-type: image\/jpeg/);
    assert.notEqual(encoded.indexOf(Buffer.from([255, 216, 255, 217])), -1);
    return { ok: true, json: async () => ({ status: 'success', menu: 'ข้าว', nutrition: { calories: 500 } }) };
  } });
  await client.analyzeFood('file:///food.jpg');
});

test('missing and oversized camera files are rejected before upload', async () => {
  for (const [fileProps, message] of [[{ exists: false }, /อ่านไฟล์ภาพจากกล้องไม่ได้/], [{ size: 0 }, /อ่านไฟล์ภาพจากกล้องไม่ได้/], [{ size: 13 * 1024 * 1024 }, /ใหญ่เกิน 12 MB/]]) {
    class InvalidFile extends CameraFile { constructor(uri) { super(uri); Object.assign(this, fileProps); } }
    const client = api({ CameraFile: InvalidFile, fetch: async () => { assert.fail('must not upload invalid file'); } });
    await assert.rejects(client.analyzeFood('file:///food.jpg'), message);
  }
});

test('connection test checks the real food service and database from the app', async () => {
  const client = api({ fetch: async (url, options) => {
    assert.equal(url, 'http://192.168.1.12:5000/api/health');
    assert.equal(options.body, undefined);
    return { ok: true, json: async () => ({ status: 'success', service: 'food-analysis', database: 'connected' }) };
  } });
  await client.checkFoodApiConnection();
});

test('connection test distinguishes app network access from unavailable database and wrong service', async () => {
  await assert.rejects(api({ fetch: async () => { throw new TypeError('Network request failed'); } }).checkFoodApiConnection(), /สิทธิ์เครือข่ายท้องถิ่นของ Expo Go/);
  await assert.rejects(api({ fetch: async () => ({ ok: false, json: async () => ({ status: 'error', message: 'ฐานข้อมูลยังไม่พร้อม' }) }) }).checkFoodApiConnection(), /ฐานข้อมูลยังไม่พร้อม/);
  await assert.rejects(api({ fetch: async () => ({ ok: true, json: async () => ({ status: 'success' }) }) }).checkFoodApiConnection(), /บริการอาหารหรือฐานข้อมูลยังไม่พร้อม/);
  await assert.rejects(api({ fetch: async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }) }).checkFoodApiConnection(), /ที่อยู่นี้ไม่ได้ตอบกลับเป็นเซิร์ฟเวอร์อาหาร/);
});

test('connection test cancels after the diagnostic timeout', async () => {
  let cleared = false;
  const client = api({ setTimeout: (fn, duration) => {
    assert.equal(duration, 8000);
    queueMicrotask(fn);
    return 1;
  }, clearTimeout: () => { cleared = true; }, fetch: async (_url, options) => {
    await Promise.resolve();
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  } });
  await assert.rejects(client.checkFoodApiConnection(), /แอปเชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
  assert.equal(cleared, true);
});
for (const scenario of ['offline', 'html', 'database', 'empty']) {
  test(`reports ${scenario} distinctly`, async () => {
    const client = api({ os: 'web', fetch: async (url) => {
      if (url === 'photo') return { blob: async () => new Blob(['jpeg']) };
      if (scenario === 'offline') throw new TypeError('Network request failed');
      if (scenario === 'html') return { ok: false, status: 502, json: async () => { throw new SyntaxError(); } };
      return { ok: scenario === 'empty', status: 503, json: async () => ({ status: scenario === 'empty' ? 'empty' : 'error', message: scenario === 'empty' ? 'ไม่พบอาหาร' : 'ฐานข้อมูลอาหารไม่ได้' }) };
    } });
    const expected = { offline: /ส่งภาพไปเซิร์ฟเวอร์ไม่สำเร็จ/, html: /HTTP 502/, database: /ฐานข้อมูลอาหารไม่ได้/, empty: /ไม่พบอาหาร/ }[scenario];
    await assert.rejects(client.analyzeFood('photo'), expected);
  });
}
test('timeout cancels request and offers retry', async () => {
  const client = api({ os: 'web', setTimeout: (fn) => { queueMicrotask(fn); return 1; }, clearTimeout: () => {}, fetch: async (url, options) => {
    if (url === 'photo') return { blob: async () => new Blob(['jpeg']) };
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  } });
  await assert.rejects(client.analyzeFood('photo'), /ใช้เวลานานเกินไป/);
});
