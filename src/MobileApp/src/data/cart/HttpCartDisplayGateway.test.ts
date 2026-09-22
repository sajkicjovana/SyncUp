import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpCartDisplayGateway } from './HttpCartDisplayGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
type MockResponse = Partial<Response> & { json: () => Promise<unknown> };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const ticketUrl = API_URL + '/api/Ticket/events/42/tickets';
const resourceUrl = API_URL + '/api/Resource/42/resources';
const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));

function mockFetch(ticketResponse: MockResponse, resourceResponse: MockResponse) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return (input === ticketUrl ? ticketResponse : resourceResponse) as Response;
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

test('starts resource GET only after ticket response and JSON finish, preserving exact URLs and headers', async () => {
  const calls: FetchCall[] = [];
  const parses: string[] = [];
  let resolveTicket!: (response: Response) => void;
  let resolveTicketJson!: (value: unknown) => void;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    if (input === ticketUrl) return new Promise<Response>(resolve => { resolveTicket = resolve; });
    return Promise.resolve({
      ok: true,
      json: async () => { parses.push('resource'); return []; },
    } as Response);
  }) as typeof fetch;

  const loading = httpCartDisplayGateway.loadDisplayData('42', 'token-value');
  await nextTurn();
  assert.deepEqual(calls, [{ input: ticketUrl, init: { headers: { 'Accept-Language': 'sr' } } }]);

  resolveTicket({
    ok: true,
    json: () => {
      parses.push('ticket');
      return new Promise<unknown>(resolve => { resolveTicketJson = resolve; });
    },
  } as Response);
  await nextTurn();
  assert.equal(calls.length, 1);
  assert.deepEqual(parses, ['ticket']);

  resolveTicketJson([]);
  await nextTurn();
  assert.deepEqual(calls, [
    { input: ticketUrl, init: { headers: { 'Accept-Language': 'sr' } } },
    { input: resourceUrl, init: { headers: { Authorization: 'Bearer token-value', 'Accept-Language': 'sr' } } },
  ]);
  assert.deepEqual(await loading, { tickets: [], resources: [] });
  assert.deepEqual(parses, ['ticket', 'resource']);
});

for (const token of [null, ''] as const) {
  test('omits resource Authorization for a falsy token', async () => {
    const calls = mockFetch(
      { ok: true, json: async () => [] },
      { ok: true, json: async () => [] },
    );

    await httpCartDisplayGateway.loadDisplayData('42', token);

    assert.deepEqual(calls, [
      { input: ticketUrl, init: { headers: { 'Accept-Language': 'sr' } } },
      { input: resourceUrl, init: { headers: { 'Accept-Language': 'sr' } } },
    ]);
  });
}

test('maps raw IDs, prices, response order and duplicates without fallback or normalization', async () => {
  mockFetch(
    {
      ok: true,
      json: async () => [
        { ticketID: 0, typeName: 'Zero', price: 0 },
        { ticketID: null, typeName: 'Null', price: null },
        { typeName: 'Missing' },
        { ticketID: 0, typeName: 'Zero', price: 0 },
      ],
    },
    {
      ok: true,
      json: async () => [
        { id: 0, name: 'Zero', price: 0 },
        { id: null, name: 'Null', price: null },
        { name: 'Missing' },
        { id: 0, name: 'Zero', price: 0 },
      ],
    },
  );

  assert.deepEqual(await httpCartDisplayGateway.loadDisplayData('42', 'token'), {
    tickets: [
      { id: 0, name: 'Zero', price: 0 },
      { id: null, name: 'Null', price: null },
      { id: undefined, name: 'Missing', price: undefined },
      { id: 0, name: 'Zero', price: 0 },
    ],
    resources: [
      { id: 0, name: 'Zero', price: 0 },
      { id: null, name: 'Null', price: null },
      { id: undefined, name: 'Missing', price: undefined },
      { id: 0, name: 'Zero', price: 0 },
    ],
  });
});

test('ticket non-OK skips ticket JSON and still loads resources', async () => {
  let ticketParses = 0;
  let resourceParses = 0;
  const calls = mockFetch(
    { ok: false, json: async () => { ticketParses++; return []; } },
    { ok: true, json: async () => { resourceParses++; return [{ id: 3, name: 'Chair', price: 5 }]; } },
  );

  assert.deepEqual(await httpCartDisplayGateway.loadDisplayData('42', 'token'), {
    tickets: [],
    resources: [{ id: 3, name: 'Chair', price: 5 }],
  });
  assert.equal(calls.length, 2);
  assert.equal(ticketParses, 0);
  assert.equal(resourceParses, 1);
});

test('resource non-OK skips resource JSON and returns loaded tickets', async () => {
  let ticketParses = 0;
  let resourceParses = 0;
  mockFetch(
    { ok: true, json: async () => { ticketParses++; return [{ ticketID: 4, typeName: 'Standard', price: 5 }]; } },
    { ok: false, json: async () => { resourceParses++; return []; } },
  );

  assert.deepEqual(await httpCartDisplayGateway.loadDisplayData('42', 'token'), {
    tickets: [{ id: 4, name: 'Standard', price: 5 }],
    resources: [],
  });
  assert.equal(ticketParses, 1);
  assert.equal(resourceParses, 0);
});

test('both non-OK responses return empty arrays without parsing', async () => {
  let parses = 0;
  const calls = mockFetch(
    { ok: false, json: async () => { parses++; return []; } },
    { ok: false, json: async () => { parses++; return []; } },
  );

  assert.deepEqual(await httpCartDisplayGateway.loadDisplayData('42', 'token'), { tickets: [], resources: [] });
  assert.equal(calls.length, 2);
  assert.equal(parses, 0);
});

test('ticket network failure propagates without starting resource GET', async () => {
  const error = new Error('Ticket network failure');
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    throw error;
  }) as typeof fetch;

  await assert.rejects(httpCartDisplayGateway.loadDisplayData('42', 'token'), caught => caught === error);
  assert.deepEqual(calls.map(call => call.input), [ticketUrl]);
});

test('ticket JSON failure propagates without starting resource GET', async () => {
  const error = new SyntaxError('Ticket JSON failure');
  const calls = mockFetch(
    { ok: true, json: async () => { throw error; } },
    { ok: true, json: async () => [] },
  );

  await assert.rejects(httpCartDisplayGateway.loadDisplayData('42', 'token'), caught => caught === error);
  assert.deepEqual(calls.map(call => call.input), [ticketUrl]);
});

test('resource network failure propagates after ticket JSON', async () => {
  const error = new Error('Resource network failure');
  const calls: FetchCall[] = [];
  let ticketParses = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    if (input === resourceUrl) throw error;
    return { ok: true, json: async () => { ticketParses++; return []; } } as Response;
  }) as typeof fetch;

  await assert.rejects(httpCartDisplayGateway.loadDisplayData('42', 'token'), caught => caught === error);
  assert.deepEqual(calls.map(call => call.input), [ticketUrl, resourceUrl]);
  assert.equal(ticketParses, 1);
});

test('resource JSON failure propagates after ticket JSON', async () => {
  const error = new SyntaxError('Resource JSON failure');
  let ticketParses = 0;
  const calls = mockFetch(
    { ok: true, json: async () => { ticketParses++; return []; } },
    { ok: true, json: async () => { throw error; } },
  );

  await assert.rejects(httpCartDisplayGateway.loadDisplayData('42', 'token'), caught => caught === error);
  assert.deepEqual(calls.map(call => call.input), [ticketUrl, resourceUrl]);
  assert.equal(ticketParses, 1);
});
