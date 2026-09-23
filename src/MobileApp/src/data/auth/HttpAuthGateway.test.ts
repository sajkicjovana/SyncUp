import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpAuthGateway } from './HttpAuthGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const passwords = { currentPassword: 'Current1!', newPassword: 'NewPass2!' };
const registration = {
  firstName: ' Demo ',
  lastName: ' User ',
  email: ' demo@example.test ',
  password: ' Abcdef1! ',
  confirmPassword: ' Abcdef1! ',
};

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

test('registration preserves endpoint, POST, headers, exact body, and skips success JSON', async () => {
  let jsonReads = 0;
  const calls = mockFetch({
    ok: true,
    json: async () => {
      jsonReads += 1;
      return { ignored: true };
    },
  });

  assert.deepEqual(await httpAuthGateway.registerUser(registration), { ok: true });
  assert.equal(jsonReads, 0);
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/User/register`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'sr',
      },
      body: JSON.stringify({
        ...registration,
        role: 'MobileUser',
      }),
    },
  }]);
});

test('registration preserves a non-OK backend JSON message', async () => {
  mockFetch({ ok: false, json: async () => ({ message: 'Rejected' }) });
  assert.deepEqual(await httpAuthGateway.registerUser(registration), {
    ok: false,
    message: 'Rejected',
  });
});

test('registration preserves missing and falsy backend message values', async () => {
  for (const message of [undefined, '', 0] as const) {
    mockFetch({ ok: false, json: async () => ({ message }) });
    assert.deepEqual(await httpAuthGateway.registerUser(registration), {
      ok: false,
      message,
    });
  }
});

test('registration preserves the baseline failure for a null rejection payload', async () => {
  mockFetch({ ok: false, json: async () => null });
  await assert.rejects(httpAuthGateway.registerUser(registration), TypeError);
});

test('registration propagates transport and rejection-JSON failures', async () => {
  const networkError = new Error('Network failure');
  globalThis.fetch = (async () => { throw networkError; }) as typeof fetch;
  await assert.rejects(
    httpAuthGateway.registerUser(registration),
    (caught) => caught === networkError,
  );

  const jsonError = new SyntaxError('Invalid JSON');
  mockFetch({ ok: false, json: async () => { throw jsonError; } });
  await assert.rejects(
    httpAuthGateway.registerUser(registration),
    (caught) => caught === jsonError,
  );
});

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

test('password change preserves endpoint, PUT, headers, body, and successful JSON parsing', async () => {
  let textReads = 0;
  const calls = mockFetch({
    ok: true,
    text: async () => {
      textReads += 1;
      return JSON.stringify({ message: 'Changed' });
    },
  });

  assert.deepEqual(await httpAuthGateway.changePassword('stored-token', {
    currentPassword: ' Current1! ',
    newPassword: ' NewPass2! ',
  }), { ok: true });
  assert.equal(textReads, 1);
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/User/change-password`,
    init: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer stored-token',
        'Accept-Language': 'sr',
      },
      body: JSON.stringify({
        currentPassword: ' Current1! ',
        newPassword: ' NewPass2! ',
      }),
    },
  }]);
});

test('password change preserves successful plain-text handling', async () => {
  mockFetch({ ok: true, text: async () => 'Changed' });
  assert.deepEqual(await httpAuthGateway.changePassword('token', passwords), { ok: true });
});

for (const [label, raw, expected] of [
  ['JSON message', JSON.stringify({ message: 'Rejected' }), 'Rejected'],
  ['plain-text message', 'Rejected', 'Rejected'],
  ['empty plain-text message', '', ''],
  ['missing JSON message', JSON.stringify({}), undefined],
] as const) {
  test(`password change preserves a non-OK ${label}`, async () => {
    mockFetch({ ok: false, text: async () => raw });
    assert.deepEqual(
      await httpAuthGateway.changePassword('token', passwords),
      { ok: false, message: expected },
    );
  });
}

test('password change preserves the baseline failure for a non-OK null JSON body', async () => {
  mockFetch({ ok: false, text: async () => 'null' });
  await assert.rejects(httpAuthGateway.changePassword('token', passwords), TypeError);
});

test('password change propagates a network failure', async () => {
  const error = new Error('Network failure');
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;
  await assert.rejects(httpAuthGateway.changePassword('token', passwords), (caught) => caught === error);
});

test('password change propagates a response-text failure', async () => {
  const error = new Error('Text failure');
  mockFetch({ ok: false, text: async () => { throw error; } });
  await assert.rejects(httpAuthGateway.changePassword('token', passwords), (caught) => caught === error);
});
