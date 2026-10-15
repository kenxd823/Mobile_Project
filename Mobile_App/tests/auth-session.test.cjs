const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');

function setup(initial, request) {
  const data = new Map(Object.entries(initial));
  class AccountError extends Error { constructor(status) { super('unauthorized'); this.status = status; } }
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key), getAllKeys: async () => [...data.keys()], multiRemove: async keys => keys.forEach(key => data.delete(key)) };
  const api = load('src/services/auth-session.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    './account-api': { AccountError, accountRequest: (...args) => request(AccountError, ...args) },
  });
  return { ...api, data, storage };
}

test('an old stored email cannot bypass login without a server-issued session', async () => {
  const api = setup({ userEmail: 'not-registered@example.test', 'profile:old:elderly': 'keep' }, () => { throw new Error('must not call server'); });
  assert.equal(await api.restoreSession(), null);
  assert.equal(api.data.has('userEmail'), false);
  assert.equal(api.data.get('profile:old:elderly'), 'keep');
});

test('session is accepted only after server validation and uses the server identity', async () => {
  const api = setup({ authToken: 'valid', userEmail: 'forged@example.test' }, (_error, path, body, token) => {
    assert.equal(path, 'session'); assert.equal(token, 'valid'); assert.equal(body, undefined);
    return { email: 'registered@example.test' };
  });
  assert.equal((await api.restoreSession()).email, 'registered@example.test');
  assert.equal(api.data.get('userEmail'), 'registered@example.test');
});

test('invalid sessions are removed; network errors never grant access', async () => {
  const invalid = setup({ authToken: 'invalid', userEmail: 'old', userRole: 'elderly' }, AccountError => { throw new AccountError(401); });
  assert.equal(await invalid.restoreSession(), null);
  assert.equal(invalid.data.size, 0);
  const offline = setup({ authToken: 'valid' }, () => { throw new Error('offline'); });
  await assert.rejects(offline.restoreSession(), /offline/);
});

test('incomplete login responses cannot create sessions and logout clears all auth keys', async () => {
  const api = setup({}, () => {});
  await assert.rejects(api.storeSession({ email: 'test' }), /เซิร์ฟเวอร์/);
  assert.equal(api.data.size, 0);
  await api.storeSession({ email: 'registered@example.test', token: 'server-token' });
  assert.equal(api.data.get('authToken'), 'server-token');
  await api.clearSession();
  assert.equal(api.data.size, 0);
});

test('account deletion removes every patient and food record for that account only after server confirmation', async () => {
  const email = 'one@example.test';
  const api = setup({ userEmail: email, authToken: 'valid', userRole: 'elderly',
    [`profile:${email}:elderly`]: 'profile', [`profile:${email}:patients`]: 'patients', [`profile:${email}:energyGoal:patient:1`]: 'goal',
    [`food:${email}:patient:1:history`]: 'history', [`food:${email}:patient:2:pending`]: 'pending', [`food:${email}:patient:2:deleted-meals`]: 'trash',
    'profile:other@example.test:elderly': 'keep', 'food:other@example.test:history': 'keep', 'theme': 'keep',
  }, (_error, path, body, token) => {
    assert.equal(path, 'delete-account'); assert.equal(body.password, 'correct'); assert.equal(token, 'valid');
    return { status: 'success' };
  });
  await api.deleteAccountSession({ email, token: 'valid' }, 'correct');
  assert.deepEqual([...api.data.keys()].sort(), ['food:other@example.test:history', 'profile:other@example.test:elderly', 'theme']);
});

test('incorrect password or server failure cannot clear local account records', async () => {
  const api = setup({ userEmail: 'one@example.test', authToken: 'valid', 'profile:one@example.test:elderly': 'keep' }, AccountError => { throw new AccountError(403); });
  await assert.rejects(api.deleteAccountSession({ email: 'one@example.test', token: 'valid' }, 'wrong'));
  assert.equal(api.data.get('authToken'), 'valid');
  assert.equal(api.data.get('profile:one@example.test:elderly'), 'keep');
});

test('interrupted local cleanup is resumed before session restoration or a new login', async () => {
  const api = setup({ pendingAccountCleanup: 'one@example.test', userEmail: 'one@example.test', authToken: 'deleted', 'food:one@example.test:history': 'old' }, () => { throw new Error('deleted session must not be reused'); });
  assert.equal(await api.restoreSession(), null);
  assert.equal(api.data.size, 0);
  api.data.set('pendingAccountCleanup', 'one@example.test'); api.data.set('profile:one@example.test:elderly', 'stale');
  await api.storeSession({ email: 'one@example.test', token: 'new' });
  assert.equal(api.data.has('profile:one@example.test:elderly'), false);
  assert.equal(api.data.get('authToken'), 'new');
});

test('a local cleanup failure after server deletion revokes local login and preserves retry work', async () => {
  const api = setup({ userEmail: 'one@example.test', authToken: 'valid', 'food:one@example.test:history': 'old' }, () => ({ status: 'success' }));
  const remove = api.storage.multiRemove;
  api.storage.multiRemove = async () => { throw new Error('storage temporarily unavailable'); };
  await assert.rejects(api.deleteAccountSession({ email: 'one@example.test', token: 'valid' }, 'correct'), /ลบบัญชีจากเซิร์ฟเวอร์แล้ว/);
  assert.equal(api.data.has('authToken'), false);
  assert.equal(api.data.get('pendingAccountCleanup'), 'one@example.test');
  api.storage.multiRemove = remove;
  assert.equal(await api.restoreSession(), null);
  assert.equal(api.data.size, 0);
});
