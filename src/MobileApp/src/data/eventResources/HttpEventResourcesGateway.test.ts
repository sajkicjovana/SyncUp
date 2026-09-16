import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpEventResourcesGateway } from './HttpEventResourcesGateway';

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

test('resource loading builds the exact URL and Authorization header', async () => {
  const resources = [{ id: 1, name: 'Water' }];
  const calls = mockFetch({ ok: true, json: async () => resources });

  const result = await httpEventResourcesGateway.loadEventResources('42', 'token-value');

  assert.equal(result, resources);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, 'http://localhost:11061/api/Resource/42/resources');
  assert.deepEqual(calls[0].init, {
    headers: {
      Authorization: 'Bearer token-value',
      'Accept-Language': 'sr',
    },
  });
});

test('empty arrays are returned unchanged', async () => {
  const resources: unknown[] = [];
  mockFetch({ ok: true, json: async () => resources });

  const result = await httpEventResourcesGateway.loadEventResources('42', 'token-value');

  assert.equal(result, resources);
});

test('non-OK responses throw the existing error', async () => {
  mockFetch({ ok: false, json: async () => [] });

  await assert.rejects(
    httpEventResourcesGateway.loadEventResources('42', 'token-value'),
    (error) => error instanceof Error && error.message === 'Failed to load resources'
  );
});

test('network failures propagate unchanged', async () => {
  const error = new Error('Network failure');
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;

  await assert.rejects(
    httpEventResourcesGateway.loadEventResources('42', 'token-value'),
    (caught) => caught === error
  );
});

test('JSON failures propagate unchanged', async () => {
  const error = new SyntaxError('Invalid JSON');
  mockFetch({ ok: true, json: async () => { throw error; } });

  await assert.rejects(
    httpEventResourcesGateway.loadEventResources('42', 'token-value'),
    (caught) => caught === error
  );
});
