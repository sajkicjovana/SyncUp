import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpCartResourceReservationGateway } from './HttpCartResourceReservationGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const reservationUrl = API_URL + '/api/Resource/reserve';

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

test('posts exact resource-only request once and ignores non-OK status and response body', async () => {
  const calls: FetchCall[] = [];
  let jsonReads = 0;
  let textReads = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return {
      ok: false,
      json: async () => { jsonReads++; throw new Error('JSON must not be read'); },
      text: async () => { textReads++; throw new Error('Text must not be read'); },
    } as unknown as Response;
  }) as typeof fetch;

  assert.equal(await httpCartResourceReservationGateway.reserveResource({
    resourceId: 7,
    quantity: 1,
    userTicketId: null,
    token: 'token-value',
  }), undefined);

  assert.deepEqual(calls, [{
    input: reservationUrl,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-value',
        'Accept-Language': 'sr',
      },
      body: JSON.stringify({ EventResourceID: 7, Quantity: 1, UserTicketID: null }),
    },
  }]);
  assert.equal(jsonReads, 0);
  assert.equal(textReads, 0);
});

test('forwards non-null user ticket ID and supplied quantity without changing body fields', async () => {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return { ok: true } as Response;
  }) as typeof fetch;

  await httpCartResourceReservationGateway.reserveResource({
    resourceId: 9,
    quantity: 3,
    userTicketId: 42,
    token: 'token-value',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, reservationUrl);
  assert.equal(calls[0].init?.body, JSON.stringify({ EventResourceID: 9, Quantity: 3, UserTicketID: 42 }));
});

test('transport failure propagates without retry', async () => {
  const error = new Error('Network failed');
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw error; }) as typeof fetch;

  await assert.rejects(
    httpCartResourceReservationGateway.reserveResource({
      resourceId: 7,
      quantity: 1,
      userTicketId: null,
      token: 'token-value',
    }),
    caught => caught === error,
  );
  assert.equal(calls, 1);
});
