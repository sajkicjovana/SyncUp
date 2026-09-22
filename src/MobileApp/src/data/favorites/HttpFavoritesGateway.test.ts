import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpFavoritesGateway } from './HttpFavoritesGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;

function mockFetch(response: Partial<Response> & { text?: () => Promise<string> }) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response as Response;
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

for (const [intent, method] of [['add', 'POST'], ['remove', 'DELETE']] as const) {
  test(`${intent} mutation preserves the endpoint, headers, and request body`, async () => {
    const calls = mockFetch({ ok: true });
    assert.deepEqual(await httpFavoritesGateway.changeFavorite('token-value', 42, intent), { ok: true });
    assert.deepEqual(calls, [{
      input: `${API_URL}/api/Favorites`,
      init: { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-value', 'Accept-Language': 'sr' }, body: '42' },
    }]);
  });
}

test('non-OK mutation preserves response text', async () => {
  mockFetch({ ok: false, text: async () => 'Server rejection' });
  assert.deepEqual(await httpFavoritesGateway.changeFavorite('token-value', 42, 'add'), { ok: false, text: 'Server rejection' });
});

test('transport failures propagate unchanged', async () => {
  const error = new Error('Network failure');
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;
  await assert.rejects(httpFavoritesGateway.changeFavorite('token-value', 42, 'add'), (caught) => caught === error);
});
