import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpEventLocationGateway } from './HttpEventLocationGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;

function mockFetch(response: Partial<Response> & { json: () => Promise<unknown> }) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response as Response;
  }) as typeof fetch;
  return calls;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
  AsyncStorage.getItem = originalGetItem;
}

test.beforeEach(() => {
  AsyncStorage.getItem = async () => 'sr';
});

test.afterEach(restoreFetch);

test('geocoding builds the exact encoded URL and preserves effective headers', async () => {
  AsyncStorage.getItem = async () => 'sr';
  const calls = mockFetch({
    ok: true,
    json: async () => [{ lat: '44.8125abc', lon: '20.4612xyz' }, { lat: '1', lon: '2' }],
  });

  const result = await httpEventLocationGateway.geocodeLocation('City + venue & hall');

  assert.deepEqual(result, { latitude: 44.8125, longitude: 20.4612 });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].input,
    'https://nominatim.openstreetmap.org/search?format=json&q=City%20%2B%20venue%20%26%20hall'
  );
  assert.deepEqual(calls[0].init, {
    headers: {
      'User-Agent': 'SyncUpApp/1.0 (support@syncupapp.com)',
      'Accept-Language': 'sr',
    },
  });
});

test('empty results return null', async () => {
  mockFetch({ ok: true, json: async () => [] });

  assert.equal(await httpEventLocationGateway.geocodeLocation('Unknown'), null);
});

test('non-OK responses return null without parsing JSON', async () => {
  let parsed = false;
  mockFetch({
    ok: false,
    json: async () => {
      parsed = true;
      return [{ lat: '1', lon: '2' }];
    },
  });

  assert.equal(await httpEventLocationGateway.geocodeLocation('Unavailable'), null);
  assert.equal(parsed, false);
});

test('network failures propagate unchanged', async () => {
  const error = new Error('Network failure');
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;

  await assert.rejects(httpEventLocationGateway.geocodeLocation('City'), (caught) => caught === error);
});

test('JSON failures propagate unchanged', async () => {
  const error = new SyntaxError('Invalid JSON');
  mockFetch({ ok: true, json: async () => { throw error; } });

  await assert.rejects(httpEventLocationGateway.geocodeLocation('City'), (caught) => caught === error);
});
