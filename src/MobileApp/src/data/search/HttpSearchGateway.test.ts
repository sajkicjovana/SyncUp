import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import type { SearchCriteria, SearchEvent } from '../../domain/search';
import { httpSearchGateway } from './HttpSearchGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const criteria: SearchCriteria = {
  searchQuery: '', selectedLocation: null, startDate: null, endDate: null,
  sortBy: 'popularity', selectedCategory: null,
};
const event: SearchEvent = { id: 1, title: 'Demo', startDate: '', location: 'City', imageUrl: '' };

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

test('search uses the exact endpoint, default query, headers, and preserves result order and duplicates', async () => {
  const events = [{ ...event, id: 2 }, event, event];
  const calls = mockFetch({ ok: true, json: async () => events });

  const result = await httpSearchGateway.search(criteria);

  assert.equal(result, events);
  assert.deepEqual(result, [{ ...event, id: 2 }, event, event]);
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/Events/search?sortBy=popularity&sortOrder=desc`,
    init: { headers: { 'Accept-Language': 'sr' } },
  }]);
});

test('search preserves full query order, dates, whitespace, location and URL encoding', async () => {
  const calls = mockFetch({ ok: true, json: async () => [] });
  const input: SearchCriteria = {
    searchQuery: ' A+B & \u010C ',
    selectedLocation: ' City ',
    startDate: new Date('2026-09-16T18:25:13.123+02:00'),
    endDate: new Date('2026-09-15T01:00:00+02:00'),
    sortBy: 'popularity',
    selectedCategory: 'Music',
  };

  await httpSearchGateway.search(input);

  assert.equal(calls[0].input,
    `${API_URL}/api/Events/search?name=+A%2BB+%26+%C4%8C+&location=+City+&startDate=2026-09-16T16%3A25%3A13.123Z&endDate=2026-09-14T23%3A00%3A00.000Z&sortBy=popularity&sortOrder=desc&category=Music`);
});

test('empty optional criteria are omitted while whitespace-only values remain', async () => {
  const calls = mockFetch({ ok: true, json: async () => [] });

  await httpSearchGateway.search({ ...criteria, searchQuery: '', selectedLocation: '', selectedCategory: '', sortBy: '' });
  const withFreeFlag = { ...criteria, searchQuery: ' ', selectedLocation: ' ', sortBy: '', isFree: true };
  await httpSearchGateway.search(withFreeFlag);

  assert.deepEqual(calls.map((call) => call.input), [
    `${API_URL}/api/Events/search?`,
    `${API_URL}/api/Events/search?name=+&location=+`,
  ]);
});

for (const [sortBy, query] of [
  ['popularity', 'sortBy=popularity&sortOrder=desc'],
  ['priceAsc', 'sortBy=price&sortOrder=asc'],
  ['priceDesc', 'sortBy=price&sortOrder=desc'],
  ['dateAsc', 'sortBy=startDate&sortOrder=asc'],
  ['dateDesc', 'sortBy=startDate&sortOrder=desc'],
  ['', ''],
  ['unknown', ''],
  ['Popularity', ''],
] as const) {
  test(`sort choice ${sortBy || 'empty'} preserves its exact backend query`, async () => {
    const calls = mockFetch({ ok: true, json: async () => [] });
    await httpSearchGateway.search({ ...criteria, sortBy });
    assert.equal(calls[0].input, `${API_URL}/api/Events/search?${query}`);
  });
}

test('an invalid date throws synchronously before any request', () => {
  const calls = mockFetch({ ok: true, json: async () => [] });

  assert.throws(() => httpSearchGateway.search({ ...criteria, startDate: new Date('invalid') }), RangeError);
  assert.throws(() => httpSearchGateway.search({ ...criteria, endDate: new Date('invalid') }), RangeError);
  assert.equal(calls.length, 0);
});

test('non-OK search responses are still parsed without a status check', async () => {
  const events = [event];
  let parses = 0;
  mockFetch({ ok: false, json: async () => { parses++; return events; } });

  assert.equal(await httpSearchGateway.search(criteria), events);
  assert.equal(parses, 1);
});

test('search network failures propagate unchanged', async () => {
  const error = new Error('Network failure');
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;
  await assert.rejects(httpSearchGateway.search(criteria), (caught) => caught === error);
});

test('search JSON failures propagate unchanged', async () => {
  const error = new SyntaxError('Invalid JSON');
  mockFetch({ ok: true, json: async () => { throw error; } });
  await assert.rejects(httpSearchGateway.search(criteria), (caught) => caught === error);
});

test('location lookup keeps its existing endpoint and JSON behavior', async () => {
  const events = [event, event];
  const calls = mockFetch({ ok: false, json: async () => events });

  assert.equal(await httpSearchGateway.getLocationEvents(), events);
  assert.equal(calls[0].input, `${API_URL}/api/Events`);
  assert.deepEqual(calls[0].init, { headers: { 'Accept-Language': 'sr' } });
});

test('price lookup keeps its existing endpoint and JSON behavior', async () => {
  const price = { minPrice: 0, maxPrice: null };
  const calls = mockFetch({ ok: false, json: async () => price });

  assert.equal(await httpSearchGateway.getEventPrice(42), price);
  assert.equal(calls[0].input, `${API_URL}/api/Events/Details?id=42`);
  assert.deepEqual(calls[0].init, { headers: { 'Accept-Language': 'sr' } });
});
