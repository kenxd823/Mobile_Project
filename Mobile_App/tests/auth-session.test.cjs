const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-module.cjs');

function setup(initial, request) {
  const data = new Map(Object.entries(initial));
  class AccountError extends Error { constructor(status) { super('unauthorized'); this.status = status; } }
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key) };
  const api = load('src/services/auth-session.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    './account-api': { AccountError, accountRequest: (...args) => request(AccountError, ...args) },
  });
  return { ...api, data };
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
