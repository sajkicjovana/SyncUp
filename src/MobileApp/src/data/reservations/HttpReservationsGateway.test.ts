import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpReservationsGateway } from './HttpReservationsGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalGetItem = AsyncStorage.getItem;
const dto = {
  reservationID: 7,
  eventResourceID: 70,
  eventID: 10,
  eventTitle: 'Demo',
  eventDate: '2026-09-22T10:00:00',
  eventEndDate: '2026-09-22T12:00:00',
  eventLocation: 'City',
  isEventFree: false,
  resourceName: 'Water',
  resourceCategory: 'FoodAndBeverage',
  resourceDescription: 'Bottled water',
  quantity: 2,
  reservedAt: '2026-09-21T10:00:00',
  userTickets: [
    { userTicketID: 11, ticketType: 'Standard' },
    { userTicketID: 12, ticketType: null },
  ],
};

function mockFetch(response: Partial<Response> & { json: () => Promise<unknown> }) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response as Response;
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => { AsyncStorage.getItem = async () => 'sr'; });
test.afterEach(() => { globalThis.fetch = originalFetch; AsyncStorage.getItem = originalGetItem; });

test('uses the exact GET endpoint and bearer header and maps the backend DTO without normalizing values', async () => {
  const calls = mockFetch({ ok: true, json: async () => [dto] });

  const result = await httpReservationsGateway.loadMyReservations('token-value');

  assert.deepEqual(calls, [{
    input: `${API_URL}/api/Resource/my-reservations`,
    init: { headers: { Authorization: 'Bearer token-value', 'Accept-Language': 'sr' } },
  }]);
  assert.equal(calls.length, 1);
  assert.equal((calls[0].init as RequestInit | undefined)?.method, undefined);
  assert.equal((calls[0].init as RequestInit | undefined)?.body, undefined);
  assert.deepEqual(result, {
    ok: true,
    rows: [{
      ReservationID: 7,
      EventResourceID: 70,
      EventID: 10,
      EventTitle: 'Demo',
      EventDate: '2026-09-22T10:00:00',
      EventEndDate: '2026-09-22T12:00:00',
      EventLocation: 'City',
      IsEventFree: false,
      ResourceName: 'Water',
      ResourceCategory: 'FoodAndBeverage',
      ResourceDescription: 'Bottled water',
      Quantity: 2,
      ReservedAt: '2026-09-21T10:00:00',
      UserTickets: [
        { UserTicketID: 11, ticketType: 'Standard' },
        { UserTicketID: 12, ticketType: null },
      ],
    }],
  });
  if (result.ok) {
    assert.equal(Object.hasOwn(result.rows[0], 'UserTicketID'), false);
  }
});

test('returns empty successful arrays', async () => {
  mockFetch({ ok: true, json: async () => [] });

  assert.deepEqual(await httpReservationsGateway.loadMyReservations('token'), { ok: true, rows: [] });
});

test('preserves backend row order and duplicates', async () => {
  const second = { ...dto, eventID: 2, resourceName: 'Chair', quantity: 1 };
  mockFetch({ ok: true, json: async () => [dto, second, dto] });

  const result = await httpReservationsGateway.loadMyReservations('token');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.rows.map(r => [r.EventID, r.ResourceName, r.Quantity]), [
      [10, 'Water', 2], [2, 'Chair', 1], [10, 'Water', 2],
    ]);
  }
});

test('preserves null and missing detail values without fabricating a row-level ticket association', async () => {
  const withNulls = {
    ...dto,
    resourceDescription: null,
    userTickets: null,
  };
  const missingValues = {
    ...dto,
    reservationID: undefined,
    eventResourceID: undefined,
    resourceCategory: undefined,
    resourceDescription: undefined,
    reservedAt: undefined,
    userTickets: undefined,
  };
  mockFetch({ ok: true, json: async () => [withNulls, missingValues] });

  const result = await httpReservationsGateway.loadMyReservations('token');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.rows[0].ResourceDescription, null);
    assert.equal(result.rows[0].UserTickets, null);
    assert.equal(result.rows[1].ReservationID, undefined);
    assert.equal(result.rows[1].EventResourceID, undefined);
    assert.equal(result.rows[1].ResourceCategory, undefined);
    assert.equal(result.rows[1].ResourceDescription, undefined);
    assert.equal(result.rows[1].ReservedAt, undefined);
    assert.equal(result.rows[1].UserTickets, undefined);
    assert.equal(Object.hasOwn(result.rows[0], 'UserTicketID'), false);
    assert.equal(Object.hasOwn(result.rows[1], 'UserTicketID'), false);
  }
});

test('non-OK response is distinct and never parses JSON', async () => {
  let parses = 0;
  mockFetch({ ok: false, json: async () => { parses++; return [dto]; } });

  assert.deepEqual(await httpReservationsGateway.loadMyReservations('token'), { ok: false });
  assert.equal(parses, 0);
});

test('network failure propagates unchanged', async () => {
  const error = new Error('Network failure');
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;

  await assert.rejects(httpReservationsGateway.loadMyReservations('token'), caught => caught === error);
});

test('invalid JSON propagates unchanged', async () => {
  const error = new SyntaxError('Invalid JSON');
  mockFetch({ ok: true, json: async () => { throw error; } });

  await assert.rejects(httpReservationsGateway.loadMyReservations('token'), caught => caught === error);
});

test('unexpected non-array JSON preserves the adapter failure behavior', async () => {
  mockFetch({ ok: true, json: async () => ({ reservationID: 7 }) });

  await assert.rejects(httpReservationsGateway.loadMyReservations('token'), TypeError);
});

test('invalid nested userTickets mapping failure propagates', async () => {
  mockFetch({ ok: true, json: async () => [{ ...dto, userTickets: {} }] });

  await assert.rejects(httpReservationsGateway.loadMyReservations('token'), TypeError);
});
