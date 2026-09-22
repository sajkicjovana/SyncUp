import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpTicketSelectionGateway } from './HttpTicketSelectionGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
type MockResponse = Partial<Response> & { json: () => Promise<unknown> };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const ticketUrl = `${API_URL}/api/Ticket/events/42/tickets`;
const resourceUrl = `${API_URL}/api/Resource/42/resources`;

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

test('starts both exact GET requests before parsing, then parses tickets before resources', async () => {
  const calls: FetchCall[] = [];
  const parses: string[] = [];
  let resolveTicket!: (response: Response) => void;
  let resolveResource!: (response: Response) => void;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Promise<Response>((resolve) => {
      if (input === ticketUrl) resolveTicket = resolve;
      else resolveResource = resolve;
    });
  }) as typeof fetch;

  const loading = httpTicketSelectionGateway.loadOptions('42', 'token-value');
  await Promise.resolve();
  assert.deepEqual(calls, [
    { input: ticketUrl, init: { headers: { 'Accept-Language': 'sr' } } },
    { input: resourceUrl, init: { headers: { Authorization: 'Bearer token-value', 'Accept-Language': 'sr' } } },
  ]);
  assert.equal(parses.length, 0);

  resolveTicket({ ok: true, json: async () => { parses.push('ticket'); return []; } } as Response);
  await Promise.resolve();
  assert.equal(parses.length, 0);

  resolveResource({ ok: true, json: async () => { parses.push('resource'); return []; } } as Response);
  assert.deepEqual(await loading, { tickets: [], resources: [] });
  assert.deepEqual(parses, ['ticket', 'resource']);
});

test('null token still requests both endpoints with Bearer null', async () => {
  const calls = mockFetch(
    { ok: true, json: async () => [] },
    { ok: true, json: async () => [] },
  );

  await httpTicketSelectionGateway.loadOptions('42', null);

  assert.deepEqual(calls, [
    { input: ticketUrl, init: { headers: { 'Accept-Language': 'sr' } } },
    { input: resourceUrl, init: { headers: { Authorization: 'Bearer null', 'Accept-Language': 'sr' } } },
  ]);
});

test('maps exact values, nullish IDs, order, duplicates and absent optional resource values', async () => {
  const tickets = [
    { ticketID: 0, typeName: 'Zero', price: 0, available: 0 },
    { ticketID: null, typeName: 'Fallback', price: 10, available: 2 },
    { typeName: 'Missing', price: 15, available: 3 },
    { ticketID: 0, typeName: 'Zero', price: 0, available: 0 },
  ];
  const resources = [
    { id: 0, name: 'Zero', price: 0, quantity: 0, measure: 'piece' },
    { id: null, name: 'Fallback', price: null, quantity: 2 },
    { name: 'Missing', quantity: 3 },
    { id: 0, name: 'Zero', price: 0, quantity: 0, measure: 'piece' },
  ];
  mockFetch(
    { ok: true, json: async () => tickets },
    { ok: true, json: async () => resources },
  );

  assert.deepEqual(await httpTicketSelectionGateway.loadOptions('42', 'token'), {
    tickets: [
      { id: 0, name: 'Zero', price: 0, available: 0 },
      { id: 1, name: 'Fallback', price: 10, available: 2 },
      { id: 2, name: 'Missing', price: 15, available: 3 },
      { id: 0, name: 'Zero', price: 0, available: 0 },
    ],
    resources: [
      { id: 0, name: 'Zero', price: 0, quantity: 0, measure: 'piece' },
      { id: 1, name: 'Fallback', price: undefined, quantity: 2, measure: undefined },
      { id: 2, name: 'Missing', price: undefined, quantity: 3, measure: undefined },
      { id: 0, name: 'Zero', price: 0, quantity: 0, measure: 'piece' },
    ],
  });
});

test('ticket non-OK skips its JSON but still loads resources', async () => {
  let ticketParses = 0;
  let resourceParses = 0;
  mockFetch(
    { ok: false, json: async () => { ticketParses++; return []; } },
    { ok: true, json: async () => { resourceParses++; return [{ id: 3, name: 'Chair', quantity: 1 }]; } },
  );

  assert.deepEqual(await httpTicketSelectionGateway.loadOptions('42', 'token'), {
    tickets: [],
    resources: [{ id: 3, name: 'Chair', price: undefined, quantity: 1, measure: undefined }],
  });
  assert.equal(ticketParses, 0);
  assert.equal(resourceParses, 1);
});

test('resource non-OK skips its JSON but still loads tickets', async () => {
  let ticketParses = 0;
  let resourceParses = 0;
  mockFetch(
    { ok: true, json: async () => { ticketParses++; return [{ ticketID: 4, typeName: 'Standard', price: 5, available: 2 }]; } },
    { ok: false, json: async () => { resourceParses++; return []; } },
  );

  assert.deepEqual(await httpTicketSelectionGateway.loadOptions('42', 'token'), {
    tickets: [{ id: 4, name: 'Standard', price: 5, available: 2 }],
    resources: [],
  });
  assert.equal(ticketParses, 1);
  assert.equal(resourceParses, 0);
});

test('both non-OK responses become empty lists without parsing', async () => {
  let parses = 0;
  mockFetch(
    { ok: false, json: async () => { parses++; return []; } },
    { ok: false, json: async () => { parses++; return []; } },
  );

  assert.deepEqual(await httpTicketSelectionGateway.loadOptions('42', 'token'), { tickets: [], resources: [] });
  assert.equal(parses, 0);
});

test('ticket JSON failure propagates before resource JSON is parsed', async () => {
  const error = new SyntaxError('Ticket JSON failure');
  let resourceParses = 0;
  mockFetch(
    { ok: true, json: async () => { throw error; } },
    { ok: true, json: async () => { resourceParses++; return []; } },
  );

  await assert.rejects(httpTicketSelectionGateway.loadOptions('42', 'token'), caught => caught === error);
  assert.equal(resourceParses, 0);
});

test('resource JSON failure propagates after ticket JSON is parsed', async () => {
  const error = new SyntaxError('Resource JSON failure');
  let ticketParses = 0;
  mockFetch(
    { ok: true, json: async () => { ticketParses++; return []; } },
    { ok: true, json: async () => { throw error; } },
  );

  await assert.rejects(httpTicketSelectionGateway.loadOptions('42', 'token'), caught => caught === error);
  assert.equal(ticketParses, 1);
});

for (const failedEndpoint of ['ticket', 'resource'] as const) {
  test(`${failedEndpoint} network failure propagates without parsing either response`, async () => {
    const error = new Error(`${failedEndpoint} transport failure`);
    let parses = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (input === (failedEndpoint === 'ticket' ? ticketUrl : resourceUrl)) throw error;
      return { ok: true, json: async () => { parses++; return []; } } as Response;
    }) as typeof fetch;

    await assert.rejects(httpTicketSelectionGateway.loadOptions('42', 'token'), caught => caught === error);
    assert.equal(parses, 0);
  });
}
