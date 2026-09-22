import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReservationRow, ReservationsGateway } from './ports';
import { createLoadMyReservations, createLoadReservationDetails } from './useCases';

const row: ReservationRow = {
  ReservationID: 7,
  EventResourceID: 70,
  EventID: 10,
  EventTitle: 'First title',
  EventDate: '2026-09-22',
  EventEndDate: '2026-09-23',
  EventLocation: 'First city',
  IsEventFree: true,
  ResourceName: 'Water',
  ResourceCategory: 'FoodAndBeverage',
  ResourceDescription: 'Bottled water',
  Quantity: 2,
  ReservedAt: '2026-09-20T10:00:00Z',
  UserTickets: [],
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

test('Reservation Details reads the token once and forwards the exact token once', async () => {
  let reads = 0;
  const tokens: string[] = [];
  const gateway: ReservationsGateway = {
    async loadMyReservations(token) {
      tokens.push(token);
      return { ok: true, rows: [] };
    },
  };

  const result = await createLoadReservationDetails(gateway, async () => {
    reads++;
    return 'details-token';
  })('10');

  assert.equal(reads, 1);
  assert.deepEqual(tokens, ['details-token']);
  assert.deepEqual(result, { status: 'loaded', details: null });
});

for (const missingToken of [null, '']) {
  test(`Reservation Details missing token ${String(missingToken)} skips the gateway`, async () => {
    let calls = 0;
    const gateway: ReservationsGateway = {
      async loadMyReservations() {
        calls++;
        return { ok: true, rows: [row] };
      },
    };

    const result = await createLoadReservationDetails(gateway, async () => missingToken)('10');

    assert.equal(calls, 0);
    assert.deepEqual(result, { status: 'missing-token' });
  });
}

test('Reservation Details preserves loose numeric-to-string event matching and excludes unrelated events', async () => {
  const unrelated = { ...row, ReservationID: 8, EventID: 11, EventTitle: 'Other event' };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [unrelated, row] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.equal(result.details?.EventTitle, 'First title');
    assert.deepEqual(result.details?.Resources.map(resource => resource.EventID), [10]);
  }
});

test('Reservation Details returns loaded null for successful empty data and for no matching event', async () => {
  const emptyGateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [] }),
  };
  const unmatchedGateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row] }),
  };

  assert.deepEqual(
    await createLoadReservationDetails(emptyGateway, async () => 'token')('10'),
    { status: 'loaded', details: null },
  );
  assert.deepEqual(
    await createLoadReservationDetails(unmatchedGateway, async () => 'token')('99'),
    { status: 'loaded', details: null },
  );
});

test('Reservation Details treats resource-only data with no tickets as valid details', async () => {
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(result.details?.Resources[0].UserTickets, []);
  }
});

test('Reservation Details groups by stable ID, preserves first-row metadata, sums duplicates and does not mutate input', async () => {
  const tickets = [{ UserTicketID: 1, ticketType: 'Standard' }];
  const laterSameAllocation = {
    ...row,
    ReservationID: 8,
    ResourceName: 'Later water name',
    EventTitle: 'Later title',
    EventDate: 'later date',
    EventEndDate: 'later end',
    ResourceCategory: 'Later category',
    ResourceDescription: 'Later description',
    Quantity: 3,
    ReservedAt: '2026-09-22T10:00:00Z',
    UserTickets: [{ UserTicketID: 2, ticketType: 'VIP' }],
  };
  const first = { ...row, UserTickets: tickets };
  const chair = { ...row, ReservationID: 9, EventResourceID: 72, ResourceName: 'Chair', Quantity: 1 };
  const rows = [first, laterSameAllocation, first, chair];
  const before = JSON.parse(JSON.stringify(rows));
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.deepEqual(rows, before);
  assert.deepEqual(result, {
    status: 'loaded',
    details: {
      EventTitle: 'First title',
      Resources: [
        {
          ReservationID: 7,
          ResourceName: 'Water',
          ResourceCategory: 'FoodAndBeverage',
          ResourceDescription: 'Bottled water',
          Quantity: 7,
          ReservedAt: '2026-09-22T10:00:00Z',
          EventTitle: 'First title',
          EventID: 10,
          EventDate: '2026-09-22',
          EventEndDate: '2026-09-23',
          UserTickets: tickets,
        },
        {
          ReservationID: 9,
          ResourceName: 'Chair',
          ResourceCategory: 'FoodAndBeverage',
          ResourceDescription: 'Bottled water',
          Quantity: 1,
          ReservedAt: '2026-09-20T10:00:00Z',
          EventTitle: 'First title',
          EventID: 10,
          EventDate: '2026-09-22',
          EventEndDate: '2026-09-23',
          UserTickets: [],
        },
      ],
    },
  });
});

test('Reservation Details keeps different stable IDs separate when resource names match', async () => {
  const secondAllocation = {
    ...row,
    ReservationID: 8,
    EventResourceID: 71,
    Quantity: 3,
  };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row, secondAllocation] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(
      result.details?.Resources.map(resource => ({
        ReservationID: resource.ReservationID,
        ResourceName: resource.ResourceName,
        Quantity: resource.Quantity,
      })),
      [
        { ReservationID: 7, ResourceName: 'Water', Quantity: 2 },
        { ReservationID: 8, ResourceName: 'Water', Quantity: 3 },
      ],
    );
  }
});

test('Reservation Details preserves raw JavaScript quantity addition', async () => {
  const malformedFirst = { ...row, Quantity: '2' as unknown as number };
  const later = { ...row, ReservationID: 8, Quantity: 3 };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [malformedFirst, later] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.equal(result.details?.Resources[0].Quantity, '23');
  }
});

test('Reservation Details replaces ReservedAt for a strictly later parsed instant', async () => {
  const later = { ...row, ReservationID: 8, ReservedAt: '2026-09-21T10:00:00Z' };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row, later] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.equal(result.details?.Resources[0].ReservedAt, later.ReservedAt);
  }
});

test('Reservation Details does not replace ReservedAt for an earlier parsed instant', async () => {
  const earlier = { ...row, ReservationID: 8, ReservedAt: '2026-09-19T10:00:00Z' };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row, earlier] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.equal(result.details?.Resources[0].ReservedAt, row.ReservedAt);
  }
});

test('Reservation Details does not replace ReservedAt for a differently formatted equal instant', async () => {
  const equalInstant = { ...row, ReservationID: 8, ReservedAt: '2026-09-20T12:00:00+02:00' };
  assert.notEqual(equalInstant.ReservedAt, row.ReservedAt);
  assert.equal(new Date(equalInstant.ReservedAt).getTime(), new Date(row.ReservedAt).getTime());
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row, equalInstant] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.equal(result.details?.Resources[0].ReservedAt, row.ReservedAt);
  }
});

test('Reservation Details preserves invalid-date comparison behavior', async () => {
  const invalidFirst = { ...row, ReservedAt: 'not-a-date' };
  const validLater = { ...row, ReservationID: 8, ReservedAt: '2027-01-01T00:00:00Z' };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [invalidFirst, validLater] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.equal(result.details?.Resources[0].ReservedAt, 'not-a-date');
  }
});

test('Reservation Details preserves first encounter for numeric-looking names and first-group ticket semantics', async () => {
  const ten = {
    ...row,
    EventResourceID: 10,
    ResourceName: '10',
    UserTickets: [{ UserTicketID: 10, ticketType: 'Ten' }],
  };
  const two = {
    ...row,
    ReservationID: 8,
    EventResourceID: 2,
    ResourceName: '2',
    UserTickets: [{ UserTicketID: 2, ticketType: 'Two' }],
  };
  const ordinary = { ...row, ReservationID: 9, EventResourceID: 30, ResourceName: 'Chair' };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [ten, ordinary, two] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(result.details?.Resources.map(resource => resource.ResourceName), ['10', 'Chair', '2']);
    assert.deepEqual(result.details?.Resources[0].UserTickets, ten.UserTickets);
  }
});

test('Reservation Details keeps raw numeric and string stable IDs distinct without coercion', async () => {
  const stringId = {
    ...row,
    ReservationID: 8,
    EventResourceID: '70' as unknown as number,
    ResourceName: 'String ID resource',
  };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [row, stringId] }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(
      result.details?.Resources.map(resource => resource.ResourceName),
      ['Water', 'String ID resource'],
    );
  }
});

test('Reservation Details isolates nullish name fallback from stable IDs and preserves mixed encounter order', async () => {
  const nullFallback = {
    ...row,
    EventResourceID: null as unknown as number,
    ResourceName: 'shared-key',
  };
  const stableStringCollision = {
    ...row,
    ReservationID: 8,
    EventResourceID: 'shared-key' as unknown as number,
    ResourceName: 'Stable string ID',
    Quantity: 3,
  };
  const stableNumber = {
    ...row,
    ReservationID: 9,
    EventResourceID: 9,
    ResourceName: 'Stable number ID',
    Quantity: 1,
  };
  const undefinedFallback = {
    ...row,
    ReservationID: 10,
    EventResourceID: undefined as unknown as number,
    ResourceName: 'shared-key',
    Quantity: 4,
  };
  const secondFallback = {
    ...row,
    ReservationID: 11,
    EventResourceID: undefined as unknown as number,
    ResourceName: 'second fallback',
    Quantity: 5,
  };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({
      ok: true,
      rows: [nullFallback, stableStringCollision, stableNumber, undefinedFallback, secondFallback],
    }),
  };

  const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(
      result.details?.Resources.map(resource => [resource.ResourceName, resource.Quantity]),
      [
        ['shared-key', 6],
        ['Stable string ID', 3],
        ['Stable number ID', 1],
        ['second fallback', 5],
      ],
    );
  }
});

for (const userTickets of [null, undefined]) {
  test(`Reservation Details applies nullish ticket fallback for ${String(userTickets)}`, async () => {
    const gateway: ReservationsGateway = {
      loadMyReservations: async () => ({ ok: true, rows: [{ ...row, UserTickets: userTickets }] }),
    };

    const result = await createLoadReservationDetails(gateway, async () => 'token')('10');

    assert.equal(result.status, 'loaded');
    if (result.status === 'loaded') {
      assert.deepEqual(result.details?.Resources[0].UserTickets, []);
    }
  });
}

test('Reservation Details preserves a non-OK result', async () => {
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: false }),
  };

  assert.deepEqual(
    await createLoadReservationDetails(gateway, async () => 'token')('10'),
    { status: 'non-ok' },
  );
});

test('Reservation Details propagates gateway and token-reader failures unchanged', async () => {
  const gatewayError = new Error('Gateway failure');
  const tokenError = new Error('Token failure');
  const failingGateway: ReservationsGateway = {
    loadMyReservations: async () => { throw gatewayError; },
  };
  let gatewayCalls = 0;
  const unusedGateway: ReservationsGateway = {
    loadMyReservations: async () => { gatewayCalls++; return { ok: true, rows: [] }; },
  };

  await assert.rejects(
    createLoadReservationDetails(failingGateway, async () => 'token')('10'),
    caught => caught === gatewayError,
  );
  await assert.rejects(
    createLoadReservationDetails(unusedGateway, async () => { throw tokenError; })('10'),
    caught => caught === tokenError,
  );
  assert.equal(gatewayCalls, 0);
});

test('Reservation Details projection failures propagate unchanged', async () => {
  const projectionError = new Error('Projection failure');
  const failingRow = {
    ...row,
    get ResourceName(): string {
      throw projectionError;
    },
  };
  const gateway: ReservationsGateway = {
    loadMyReservations: async () => ({ ok: true, rows: [failingRow] }),
  };

  await assert.rejects(
    createLoadReservationDetails(gateway, async () => 'token')('10'),
    caught => caught === projectionError,
  );
});
