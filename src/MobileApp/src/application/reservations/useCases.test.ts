import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReservationRow, ReservationsGateway } from './ports';
import { createLoadMyReservations } from './useCases';

const row: ReservationRow = {
  EventID: 10,
  EventTitle: 'First title',
  EventDate: '2026-09-22',
  EventEndDate: '2026-09-23',
  EventLocation: 'First city',
  IsEventFree: true,
  ResourceName: 'Water',
  Quantity: 2,
};

test('reads the token once and forwards it once to the gateway', async () => {
  let reads = 0;
  const tokens: string[] = [];
  const gateway: ReservationsGateway = {
    async loadMyReservations(token) {
      tokens.push(token);
      return { ok: true, rows: [] };
    },
  };

  const result = await createLoadMyReservations(gateway, async () => {
    reads++;
    return 'token-value';
  })();

  assert.equal(reads, 1);
  assert.deepEqual(tokens, ['token-value']);
  assert.deepEqual(result, { status: 'loaded', reservations: [] });
});

for (const missingToken of [null, '']) {
  test(`missing token ${String(missingToken)} skips HTTP and returns a distinct outcome`, async () => {
    let reads = 0;
    let calls = 0;
    const gateway: ReservationsGateway = {
      async loadMyReservations() {
        calls++;
        return { ok: true, rows: [] };
      },
    };

    const result = await createLoadMyReservations(gateway, async () => {
      reads++;
      return missingToken;
    })();

    assert.equal(reads, 1);
    assert.equal(calls, 0);
    assert.deepEqual(result, { status: 'missing-token' });
  });
}

test('grouping preserves first-row metadata, duplicate resources and plain-object card order', async () => {
  const firstTen = row;
  const firstTwo = { ...row, EventID: 2, EventTitle: 'Second event', ResourceName: 'Chair', Quantity: 1 };
  const laterTen = {
    ...row,
    EventTitle: 'Later title',
    EventDate: 'later date',
    EventEndDate: 'later end',
    EventLocation: 'Later city',
    IsEventFree: false,
    ResourceName: 'Table',
    Quantity: 3,
  };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [firstTen, firstTwo, laterTen, firstTen] }),
  };

  const result = await createLoadMyReservations(gateway, async () => 'token')();

  assert.deepEqual(result, {
    status: 'loaded',
    reservations: [
      {
        EventID: 2,
        EventTitle: 'Second event',
        EventDate: row.EventDate,
        EventEndDate: row.EventEndDate,
        EventLocation: row.EventLocation,
        IsEventFree: row.IsEventFree,
        Resources: [{ Name: 'Chair', Quantity: 1 }],
      },
      {
        EventID: 10,
        EventTitle: 'First title',
        EventDate: row.EventDate,
        EventEndDate: row.EventEndDate,
        EventLocation: 'First city',
        IsEventFree: true,
        Resources: [
          { Name: 'Water', Quantity: 2 },
          { Name: 'Table', Quantity: 3 },
          { Name: 'Water', Quantity: 2 },
        ],
      },
    ],
  });
});

test('non-OK response stays distinct from a successful empty result', async () => {
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: false }),
  };

  assert.deepEqual(await createLoadMyReservations(gateway, async () => 'token')(), { status: 'non-ok' });
});

test('gateway failure propagates unchanged', async () => {
  const error = new Error('Transport failure');
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => { throw error; },
  };

  await assert.rejects(createLoadMyReservations(gateway, async () => 'token')(), caught => caught === error);
});

test('token-reader failure propagates unchanged without calling the gateway', async () => {
  const error = new Error('Storage failure');
  let calls = 0;
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => { calls++; return { ok: true, rows: [] }; },
  };

  await assert.rejects(createLoadMyReservations(gateway, async () => { throw error; })(), caught => caught === error);
  assert.equal(calls, 0);
});
