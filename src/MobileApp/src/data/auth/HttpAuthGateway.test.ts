import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpAuthGateway } from './HttpAuthGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response as Response;
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

test('password recovery preserves the endpoint, POST method, headers, and request body', async () => {
  const calls = mockFetch({ ok: true });

  assert.deepEqual(await httpAuthGateway.requestPasswordReset('person@example.test'), { ok: true });
  assert.deepEqual(calls, [{
    input: `${API_URL}/auth/forgot-password`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'sr',
      },
      body: JSON.stringify({ email: 'person@example.test' }),
    },
  }]);
});

test('password recovery preserves a non-OK backend JSON message', async () => {
  mockFetch({ ok: false, json: async () => ({ message: 'Rejected' }) });
  assert.deepEqual(await httpAuthGateway.requestPasswordReset('person@example.test'), { ok: false, message: 'Rejected' });
});

for (const error of [new Error('Network failure'), new SyntaxError('Invalid JSON')]) {
  test(`password recovery propagates ${error.message}`, async () => {
    if (error instanceof SyntaxError) mockFetch({ ok: false, json: async () => { throw error; } });
    else globalThis.fetch = (async () => { throw error; }) as typeof fetch;

    await assert.rejects(
      httpAuthGateway.requestPasswordReset('person@example.test'),
      (caught) => caught === error,
    );
  });
}
