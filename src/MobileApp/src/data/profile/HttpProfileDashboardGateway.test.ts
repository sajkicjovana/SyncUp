import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpProfileDashboardGateway } from './HttpProfileDashboardGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;

function mockFetch(response: Partial<Response>) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response as Response;
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  AsyncStorage.getItem = originalGetItem;
});

test('profile uses the exact implicit GET endpoint and bearer header and maps semantic fields', async () => {
  const calls = mockFetch({
    ok: true,
    json: async () => ({
      firstName: 'Ana',
      lastName: 'Anic',
      email: 'ana@example.test',
      phoneNumber: '+381601234567',
      profilePicture: '/uploads/avatar.jpg',
      ignored: 'value',
    }),
  });

  assert.deepEqual(await httpProfileDashboardGateway.loadCurrentProfile('held-token'), {
    ok: true,
    profile: {
      firstName: 'Ana',
      lastName: 'Anic',
      email: 'ana@example.test',
      phoneNumber: '+381601234567',
      profilePicture: `${API_URL}/uploads/avatar.jpg`,
    },
  });
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/MobileUser/profile`,
    init: { headers: { Authorization: 'Bearer held-token', 'Accept-Language': 'sr' } },
  }]);
  assert.equal((calls[0].init as RequestInit | undefined)?.method, undefined);
  assert.equal((calls[0].init as RequestInit | undefined)?.body, undefined);
});

test('profile preserves value-or-empty fallbacks and image normalization semantics', async () => {
  const cases = [
    {
      dto: {
        firstName: null,
        lastName: 0,
        email: false,
        phoneNumber: null,
        profilePicture: null,
      },
      expectedPicture: null,
    },
    {
      dto: {
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        profilePicture: '',
      },
      expectedPicture: null,
    },
    {
      dto: {
        firstName: 'A',
        lastName: 'B',
        email: 'C',
        phoneNumber: 'D',
        profilePicture: 'images/a.jpg',
      },
      expectedPicture: `${API_URL}/images/a.jpg`,
    },
    {
      dto: {
        firstName: 'A',
        lastName: 'B',
        email: 'C',
        phoneNumber: 'D',
        profilePicture: 'http://cdn.test/a.jpg',
      },
      expectedPicture: 'http://cdn.test/a.jpg',
    },
    {
      dto: {
        firstName: 'A',
        lastName: 'B',
        email: 'C',
        phoneNumber: 'D',
        profilePicture: 'https://cdn.test/a.jpg',
      },
      expectedPicture: 'https://cdn.test/a.jpg',
    },
  ];

  for (const { dto, expectedPicture } of cases) {
    mockFetch({ ok: true, json: async () => dto });
    const result = await httpProfileDashboardGateway.loadCurrentProfile('token');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.firstName, dto.firstName || '');
      assert.equal(result.profile.lastName, dto.lastName || '');
      assert.equal(result.profile.email, dto.email || '');
      assert.equal(result.profile.phoneNumber, dto.phoneNumber || '');
      assert.equal(result.profile.profilePicture, expectedPicture);
    }
  }
});

test('profile non-OK returns status without parsing JSON', async () => {
  let jsonReads = 0;
  mockFetch({
    ok: false,
    status: 403,
    json: async () => { jsonReads++; throw new Error('must not parse'); },
  });

  assert.deepEqual(
    await httpProfileDashboardGateway.loadCurrentProfile('token'),
    { ok: false, status: 403 },
  );
  assert.equal(jsonReads, 0);
});

test('profile malformed JSON, invalid image values, and transport failures propagate', async () => {
  const jsonError = new SyntaxError('invalid profile JSON');
  mockFetch({ ok: true, json: async () => { throw jsonError; } });
  await assert.rejects(
    httpProfileDashboardGateway.loadCurrentProfile('token'),
    caught => caught === jsonError,
  );

  mockFetch({ ok: true, json: async () => ({ profilePicture: 5 }) });
  await assert.rejects(httpProfileDashboardGateway.loadCurrentProfile('token'), TypeError);

  const networkError = new Error('profile network failure');
  globalThis.fetch = (async () => { throw networkError; }) as typeof fetch;
  await assert.rejects(
    httpProfileDashboardGateway.loadCurrentProfile('token'),
    caught => caught === networkError,
  );
});

test('credits uses the exact implicit GET endpoint and bearer header and parses success JSON', async () => {
  const data = { credits: 125, ignored: 'value' };
  const calls = mockFetch({ ok: true, json: async () => data });

  assert.deepEqual(await httpProfileDashboardGateway.loadCredits('credit-token'), {
    ok: true,
    credits: 125,
  });
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/Credit`,
    init: { headers: { Authorization: 'Bearer credit-token', 'Accept-Language': 'sr' } },
  }]);
  assert.equal((calls[0].init as RequestInit | undefined)?.method, undefined);
  assert.equal((calls[0].init as RequestInit | undefined)?.body, undefined);
});

test('credits successful malformed field shapes are returned for Application validation', async () => {
  for (const data of [{}, { credits: '125' }, null]) {
    mockFetch({ ok: true, json: async () => data });
    assert.deepEqual(await httpProfileDashboardGateway.loadCredits('token'), {
      ok: true,
      credits: data?.credits,
    });
  }
});

test('credits non-OK reads response text, preserves status, and does not parse JSON', async () => {
  let textReads = 0;
  let jsonReads = 0;
  mockFetch({
    ok: false,
    status: 500,
    text: async () => { textReads++; return 'credit error'; },
    json: async () => { jsonReads++; throw new Error('must not parse'); },
  });

  assert.deepEqual(await httpProfileDashboardGateway.loadCredits('token'), {
    ok: false,
    status: 500,
    responseText: 'credit error',
  });
  assert.equal(textReads, 1);
  assert.equal(jsonReads, 0);
});

test('credits malformed JSON, response-text failures, and transport failures propagate', async () => {
  const jsonError = new SyntaxError('invalid credit JSON');
  mockFetch({ ok: true, json: async () => { throw jsonError; } });
  await assert.rejects(
    httpProfileDashboardGateway.loadCredits('token'),
    caught => caught === jsonError,
  );

  const textError = new Error('text read failed');
  mockFetch({ ok: false, status: 500, text: async () => { throw textError; } });
  await assert.rejects(
    httpProfileDashboardGateway.loadCredits('token'),
    caught => caught === textError,
  );

  const networkError = new Error('credit network failure');
  globalThis.fetch = (async () => { throw networkError; }) as typeof fetch;
  await assert.rejects(
    httpProfileDashboardGateway.loadCredits('token'),
    caught => caught === networkError,
  );
});
