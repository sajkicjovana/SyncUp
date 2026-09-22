import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpMyTicketsGateway } from './HttpMyTicketsGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const myTicketsUrl = API_URL + '/api/ticket/tickets/my';

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

test('uses exact lowercase GET endpoint and maps every required field without reordering or deduplication', async () => {
  const calls: FetchCall[] = [];
  const backendRows = [
    {
      purchasedAt: 'first-date', ticketType: 'VIP', eventName: 'Event A', price: 0,
      eventID: 0, userTicketID: 7, validationToken: '', ticketID: 100, ignored: 'value',
    },
    {
      purchasedAt: 'second-date', ticketType: 'VIP', eventName: 'Event A', price: null,
      eventID: '5', ticketID: '100', userTicketID: '7', validationToken: null,
    },
    {
      purchasedAt: 'first-date', ticketType: 'VIP', eventName: 'Event A', price: 0,
      eventID: 0, ticketID: null, userTicketID: 7, validationToken: '',
    },
    {
      purchasedAt: 'first-date', ticketType: 'VIP', eventName: 'Event A', price: 0,
      eventID: 0, ticketID: 100, userTicketID: 7, validationToken: '',
    },
    {},
  ];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return { ok: true, json: async () => backendRows } as unknown as Response;
  }) as typeof fetch;

  assert.deepEqual(await httpMyTicketsGateway.loadMyTickets('held-token'), {
    ok: true,
    tickets: [
      { purchasedAt: 'first-date', ticketType: 'VIP', eventName: 'Event A', price: 0, eventId: 0, ticketDefinitionId: 100, userTicketId: 7, validationToken: '' },
      { purchasedAt: 'second-date', ticketType: 'VIP', eventName: 'Event A', price: null, eventId: '5', ticketDefinitionId: '100', userTicketId: '7', validationToken: null },
      { purchasedAt: 'first-date', ticketType: 'VIP', eventName: 'Event A', price: 0, eventId: 0, ticketDefinitionId: null, userTicketId: 7, validationToken: '' },
      { purchasedAt: 'first-date', ticketType: 'VIP', eventName: 'Event A', price: 0, eventId: 0, ticketDefinitionId: 100, userTicketId: 7, validationToken: '' },
      { purchasedAt: undefined, ticketType: undefined, eventName: undefined, price: undefined, eventId: undefined, ticketDefinitionId: undefined, userTicketId: undefined, validationToken: undefined },
    ],
  });
  assert.deepEqual(calls, [{
    input: myTicketsUrl,
    init: { headers: { Authorization: 'Bearer held-token', 'Accept-Language': 'sr' } },
  }]);
});

test('maps a successful empty response to an empty semantic row array', async () => {
  globalThis.fetch = (async () => ({ ok: true, json: async () => [] } as unknown as Response)) as typeof fetch;
  assert.deepEqual(await httpMyTicketsGateway.loadMyTickets('held-token'), { ok: true, tickets: [] });
});

test('returns non-OK without parsing JSON and makes only one request', async () => {
  let calls = 0;
  let jsonReads = 0;
  globalThis.fetch = (async () => {
    calls++;
    return {
      ok: false,
      json: async () => { jsonReads++; throw new Error('must not parse'); },
    } as unknown as Response;
  }) as typeof fetch;

  assert.deepEqual(await httpMyTicketsGateway.loadMyTickets('held-token'), { ok: false });
  assert.equal(calls, 1);
  assert.equal(jsonReads, 0);
});

test('malformed JSON and network failures propagate unchanged without retry', async () => {
  const jsonError = new SyntaxError('invalid JSON');
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: true, json: async () => { throw jsonError; } } as unknown as Response;
  }) as typeof fetch;
  await assert.rejects(httpMyTicketsGateway.loadMyTickets('held-token'), error => error === jsonError);
  assert.equal(calls, 1);

  const networkError = new Error('network failed');
  calls = 0;
  globalThis.fetch = (async () => { calls++; throw networkError; }) as typeof fetch;
  await assert.rejects(httpMyTicketsGateway.loadMyTickets('held-token'), error => error === networkError);
  assert.equal(calls, 1);
});

test('an unexpected non-array JSON value remains a mapping failure', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: true, json: async () => ({ tickets: [] }) } as unknown as Response;
  }) as typeof fetch;

  await assert.rejects(httpMyTicketsGateway.loadMyTickets('held-token'), TypeError);
  assert.equal(calls, 1);
});
