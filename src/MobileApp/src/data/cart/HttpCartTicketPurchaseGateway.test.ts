import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpCartTicketPurchaseGateway } from './HttpCartTicketPurchaseGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const myTicketsUrl = API_URL + '/api/Ticket/tickets/my';
const purchaseUrl = API_URL + '/api/Ticket/purchase';

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

test('my-tickets GET preserves raw mapped values, order, and duplicates', async () => {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return { ok: true, json: async () => [
      { userTicketID: 7, eventID: 5, validationToken: 'a', ignored: 'extra' },
      { userTicketID: '7', eventID: '5', validationToken: 'b' },
      { userTicketID: 7, eventID: 5, validationToken: 'a' },
      { eventID: 5 },
    ] } as unknown as Response;
  }) as typeof fetch;

  assert.deepEqual(await httpCartTicketPurchaseGateway.loadMyTickets('held-token'), {
    kind: 'loaded', tickets: [
      { userTicketId: 7, eventId: 5, validationToken: 'a' },
      { userTicketId: '7', eventId: '5', validationToken: 'b' },
      { userTicketId: 7, eventId: 5, validationToken: 'a' },
      { userTicketId: undefined, eventId: 5, validationToken: undefined },
    ],
  });
  assert.deepEqual(calls, [{
    input: myTicketsUrl,
    init: { headers: { Authorization: 'Bearer held-token', 'Accept-Language': 'sr' } },
  }]);
});

test('my-tickets non-OK returns semantic rejection without parsing body', async () => {
  let jsonReads = 0;
  globalThis.fetch = (async () => ({
    ok: false, json: async () => { jsonReads++; throw new Error('body must not be read'); },
  } as unknown as Response)) as typeof fetch;

  assert.deepEqual(await httpCartTicketPurchaseGateway.loadMyTickets('held-token'), { kind: 'rejected' });
  assert.equal(jsonReads, 0);
});

test('my-tickets malformed JSON and transport failures propagate unchanged without retry', async () => {
  const parseError = new SyntaxError('invalid JSON');
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: true, json: async () => { throw parseError; } } as unknown as Response;
  }) as typeof fetch;
  await assert.rejects(httpCartTicketPurchaseGateway.loadMyTickets('held-token'), error => error === parseError);
  assert.equal(calls, 1);

  const networkError = new Error('network failed');
  calls = 0;
  globalThis.fetch = (async () => { calls++; throw networkError; }) as typeof fetch;
  await assert.rejects(httpCartTicketPurchaseGateway.loadMyTickets('held-token'), error => error === networkError);
  assert.equal(calls, 1);
});

test('purchase POST preserves exact endpoint, headers, order, quantities, duplicates, and ignores successful body', async () => {
  const calls: FetchCall[] = [];
  let jsonReads = 0;
  let textReads = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return {
      ok: true,
      json: async () => { jsonReads++; throw new Error('must not parse success'); },
      text: async () => { textReads++; throw new Error('must not read success'); },
    } as unknown as Response;
  }) as typeof fetch;

  assert.deepEqual(await httpCartTicketPurchaseGateway.purchaseTickets([
    { ticketId: 4, quantity: 2 }, { ticketId: 4, quantity: 0 }, { ticketId: 2, quantity: 3 },
  ], 'held-token'), { kind: 'accepted' });
  assert.deepEqual(calls, [{
    input: purchaseUrl,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer held-token', 'Accept-Language': 'sr' },
      body: JSON.stringify([
        { TicketID: 4, Quantity: 2 }, { TicketID: 4, Quantity: 0 }, { TicketID: 2, Quantity: 3 },
      ]),
    },
  }]);
  assert.equal(jsonReads, 0);
  assert.equal(textReads, 0);
});

test('purchase non-OK reads exact response text and does not parse JSON', async () => {
  let jsonReads = 0;
  let textReads = 0;
  globalThis.fetch = (async () => ({
    ok: false,
    text: async () => { textReads++; return '  exact backend response  '; },
    json: async () => { jsonReads++; throw new Error('must not parse JSON'); },
  } as unknown as Response)) as typeof fetch;

  assert.deepEqual(await httpCartTicketPurchaseGateway.purchaseTickets([{ ticketId: 1, quantity: 1 }], 'held-token'), {
    kind: 'rejected', responseText: '  exact backend response  ',
  });
  assert.equal(textReads, 1);
  assert.equal(jsonReads, 0);
});

test('purchase response-text failure and transport rejection propagate without retry', async () => {
  const textError = new Error('text failed');
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, text: async () => { throw textError; } } as unknown as Response;
  }) as typeof fetch;
  await assert.rejects(httpCartTicketPurchaseGateway.purchaseTickets([{ ticketId: 1, quantity: 1 }], 'held-token'), error => error === textError);
  assert.equal(calls, 1);

  const networkError = new Error('network failed');
  calls = 0;
  globalThis.fetch = (async () => { calls++; throw networkError; }) as typeof fetch;
  await assert.rejects(httpCartTicketPurchaseGateway.purchaseTickets([{ ticketId: 1, quantity: 1 }], 'held-token'), error => error === networkError);
  assert.equal(calls, 1);
});
