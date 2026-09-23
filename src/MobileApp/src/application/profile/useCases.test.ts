import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MyTicketRow, MyTicketsGateway } from '../myTickets/ports';
import type { ReservationRow, ReservationsGateway } from '../reservations/ports';
import type {
  CurrentProfileGateway,
  ProfileDashboardGateway,
  ProfileDashboardUpdate,
} from './ports';
import {
  createLoadPersonalInfo,
  createLoadProfileDashboard,
  ProfileDashboardTokenReadError,
} from './useCases';

const profile = {
  firstName: 'Ana',
  lastName: 'Anic',
  email: 'ana@example.test',
  phoneNumber: '+381601234567',
  profilePicture: 'http://example.test/avatar.jpg',
};

const dashboardProfile = {
  firstName: profile.firstName,
  lastName: profile.lastName,
  email: profile.email,
  profilePicture: profile.profilePicture,
};

const ticket = (id: number): MyTicketRow => ({
  purchasedAt: '2026-01-01',
  ticketType: 'Standard',
  eventName: 'Event',
  price: 100,
  eventId: 1,
  ticketDefinitionId: 10,
  userTicketId: id,
  validationToken: `token-${id}`,
});

const reservation = (
  EventID: number,
  EventResourceID: number,
): ReservationRow => ({
  ReservationID: 1,
  EventResourceID,
  EventID,
  EventTitle: 'Event',
  EventDate: '2026-01-01',
  EventEndDate: '2026-01-02',
  EventLocation: 'City',
  IsEventFree: false,
  ResourceName: 'Chair',
  ResourceCategory: 'Equipment',
  ResourceDescription: 'Chair',
  Quantity: 1,
  ReservedAt: '2026-01-01',
  UserTickets: [],
});

function dependencies(overrides: {
  profileGateway?: ProfileDashboardGateway;
  ticketsGateway?: MyTicketsGateway;
  reservationsGateway?: ReservationsGateway;
} = {}) {
  return {
    profileGateway: overrides.profileGateway ?? {
      loadCurrentProfile: async () => ({ ok: true, profile }),
      loadCredits: async () => ({ ok: true, credits: 250 }),
    },
    ticketsGateway: overrides.ticketsGateway ?? {
      loadMyTickets: async () => ({ ok: true, tickets: [] }),
    },
    reservationsGateway: overrides.reservationsGateway ?? {
      loadMyReservations: async () => ({ ok: true, rows: [] }),
    },
  };
}

test('reads one held token and performs stages sequentially in profile, tickets, reservations, credits order', async () => {
  const order: string[] = [];
  const tokens: string[] = [];
  let tokenReads = 0;
  const profileGateway: ProfileDashboardGateway = {
    async loadCurrentProfile(token) {
      order.push('profile');
      tokens.push(token);
      return { ok: true, profile };
    },
    async loadCredits(token) {
      order.push('credits');
      tokens.push(token);
      return { ok: true, credits: 12 };
    },
  };
  const ticketsGateway: MyTicketsGateway = {
    async loadMyTickets(token) {
      order.push('tickets');
      tokens.push(token);
      return { ok: true, tickets: [] };
    },
  };
  const reservationsGateway: ReservationsGateway = {
    async loadMyReservations(token) {
      order.push('reservations');
      tokens.push(token);
      return { ok: true, rows: [] };
    },
  };

  const updates: ProfileDashboardUpdate[] = [];
  const result = await createLoadProfileDashboard(
    profileGateway,
    ticketsGateway,
    reservationsGateway,
    async () => { tokenReads++; return 'held-token'; },
  )(update => updates.push(update));

  assert.equal(tokenReads, 1);
  assert.deepEqual(tokens, ['held-token', 'held-token', 'held-token', 'held-token']);
  assert.deepEqual(order, ['profile', 'tickets', 'reservations', 'credits']);
  assert.deepEqual(result, { status: 'loaded' });
  assert.deepEqual(updates[0], { stage: 'authenticated' });
});

test('missing and empty tokens perform no remote calls and return missing-token', async () => {
  for (const missingToken of [null, '']) {
    let tokenReads = 0;
    let calls = 0;
    const profileGateway: ProfileDashboardGateway = {
      async loadCurrentProfile() { calls++; return { ok: true, profile }; },
      async loadCredits() { calls++; return { ok: true, credits: 0 }; },
    };
    const ticketsGateway: MyTicketsGateway = {
      async loadMyTickets() { calls++; return { ok: true, tickets: [] }; },
    };
    const reservationsGateway: ReservationsGateway = {
      async loadMyReservations() { calls++; return { ok: true, rows: [] }; },
    };
    const updates: ProfileDashboardUpdate[] = [];

    const result = await createLoadProfileDashboard(
      profileGateway,
      ticketsGateway,
      reservationsGateway,
      async () => { tokenReads++; return missingToken; },
    )(update => updates.push(update));

    assert.equal(tokenReads, 1);
    assert.equal(calls, 0);
    assert.deepEqual(updates, []);
    assert.deepEqual(result, { status: 'missing-token' });
  }
});

test('emits successful semantic profile values unchanged', async () => {
  const deps = dependencies();
  const updates: ProfileDashboardUpdate[] = [];
  await createLoadProfileDashboard(
    deps.profileGateway,
    deps.ticketsGateway,
    deps.reservationsGateway,
    async () => 'token',
  )(update => updates.push(update));

  assert.deepEqual(updates[1], {
    stage: 'profile',
    outcome: 'loaded',
    profile: dashboardProfile,
  });
});

test('personal info reads one token and returns the complete semantic current profile', async () => {
  let tokenReads = 0;
  const receivedTokens: string[] = [];
  const profileGateway: CurrentProfileGateway = {
    async loadCurrentProfile(token) {
      receivedTokens.push(token);
      return { ok: true, profile };
    },
  };

  assert.deepEqual(
    await createLoadPersonalInfo(
      profileGateway,
      async () => { tokenReads++; return 'held-token'; },
    )(),
    { status: 'loaded', profile },
  );
  assert.equal(tokenReads, 1);
  assert.deepEqual(receivedTokens, ['held-token']);
});

test('personal info missing and empty tokens perform no gateway call', async () => {
  for (const missingToken of [null, '']) {
    let tokenReads = 0;
    let profileCalls = 0;
    const profileGateway: CurrentProfileGateway = {
      async loadCurrentProfile() {
        profileCalls++;
        return { ok: true, profile };
      },
    };

    assert.deepEqual(
      await createLoadPersonalInfo(
        profileGateway,
        async () => { tokenReads++; return missingToken; },
      )(),
      { status: 'missing-token' },
    );
    assert.equal(tokenReads, 1);
    assert.equal(profileCalls, 0);
  }
});

test('personal info keeps a non-OK profile response distinguishable', async () => {
  const profileGateway: CurrentProfileGateway = {
    async loadCurrentProfile() {
      return { ok: false, status: 403 };
    },
  };

  assert.deepEqual(
    await createLoadPersonalInfo(profileGateway, async () => 'token')(),
    { status: 'non-ok', responseStatus: 403 },
  );
});

test('personal info propagates token-reader and gateway failures unchanged', async () => {
  const tokenFailure = new Error('storage failed');
  let gatewayCalls = 0;
  const profileGateway: CurrentProfileGateway = {
    async loadCurrentProfile() {
      gatewayCalls++;
      return { ok: true, profile };
    },
  };

  await assert.rejects(
    createLoadPersonalInfo(profileGateway, async () => { throw tokenFailure; })(),
    caught => caught === tokenFailure,
  );
  assert.equal(gatewayCalls, 0);

  const gatewayFailure = new Error('profile request failed');
  profileGateway.loadCurrentProfile = async () => { throw gatewayFailure; };
  await assert.rejects(
    createLoadPersonalInfo(profileGateway, async () => 'token')(),
    caught => caught === gatewayFailure,
  );
});

test('ticket count is the raw mapped row count including duplicate rows', async () => {
  const duplicate = ticket(1);
  const deps = dependencies({
    ticketsGateway: {
      loadMyTickets: async () => ({ ok: true, tickets: [duplicate, duplicate, ticket(2)] }),
    },
  });
  const updates: ProfileDashboardUpdate[] = [];
  await createLoadProfileDashboard(
    deps.profileGateway,
    deps.ticketsGateway,
    deps.reservationsGateway,
    async () => 'token',
  )(update => updates.push(update));

  assert.deepEqual(updates.find(update => update.stage === 'tickets'), {
    stage: 'tickets',
    outcome: 'loaded',
    count: 3,
  });
});

test('reservation count preserves unique truthy composite-key semantics', async () => {
  const duplicate = reservation(1, 2);
  const rows = [
    duplicate,
    duplicate,
    reservation(1, 3),
    reservation(2, 2),
    reservation(0, 4),
    reservation(4, 0),
    reservation(1, 23),
    reservation(12, 3),
  ];
  const deps = dependencies({
    reservationsGateway: {
      loadMyReservations: async () => ({ ok: true, rows }),
    },
  });
  const updates: ProfileDashboardUpdate[] = [];
  await createLoadProfileDashboard(
    deps.profileGateway,
    deps.ticketsGateway,
    deps.reservationsGateway,
    async () => 'token',
  )(update => updates.push(update));

  assert.deepEqual(updates.find(update => update.stage === 'reservations'), {
    stage: 'reservations',
    outcome: 'loaded',
    count: 5,
  });
});

test('accepts numeric credits and maps every non-number credit value to zero', async () => {
  for (const [value, expected, invalid] of [[75, 75, false], ['75', 0, true], [null, 0, true]]) {
    const deps = dependencies({
      profileGateway: {
        loadCurrentProfile: async () => ({ ok: true, profile }),
        loadCredits: async () => ({ ok: true, credits: value }),
      },
    });
    const updates: ProfileDashboardUpdate[] = [];
    await createLoadProfileDashboard(
      deps.profileGateway,
      deps.ticketsGateway,
      deps.reservationsGateway,
      async () => 'token',
    )(update => updates.push(update));
    const creditUpdate = updates.find(update => update.stage === 'credits');
    assert.equal(creditUpdate?.outcome, invalid ? 'invalid' : 'loaded');
    if (creditUpdate?.stage === 'credits' && 'credits' in creditUpdate) {
      assert.equal(creditUpdate.credits, expected);
      assert.equal(Object.hasOwn(creditUpdate, 'invalidValue'), invalid);
    }
  }
});

test('all non-OK stages remain distinct and later stages continue', async () => {
  const order: string[] = [];
  const profileGateway: ProfileDashboardGateway = {
    async loadCurrentProfile() { order.push('profile'); return { ok: false, status: 401 }; },
    async loadCredits() {
      order.push('credits');
      return { ok: false, status: 503, responseText: 'credit unavailable' };
    },
  };
  const ticketsGateway: MyTicketsGateway = {
    async loadMyTickets() { order.push('tickets'); return { ok: false }; },
  };
  const reservationsGateway: ReservationsGateway = {
    async loadMyReservations() { order.push('reservations'); return { ok: false }; },
  };
  const updates: ProfileDashboardUpdate[] = [];

  assert.deepEqual(
    await createLoadProfileDashboard(
      profileGateway,
      ticketsGateway,
      reservationsGateway,
      async () => 'token',
    )(update => updates.push(update)),
    { status: 'loaded' },
  );
  assert.deepEqual(order, ['profile', 'tickets', 'reservations', 'credits']);
  assert.deepEqual(updates.slice(1), [
    { stage: 'profile', outcome: 'non-ok', status: 401 },
    { stage: 'tickets', outcome: 'non-ok' },
    { stage: 'reservations', outcome: 'non-ok' },
    { stage: 'credits', outcome: 'non-ok', status: 503, responseText: 'credit unavailable' },
  ]);
});

for (const failedStage of ['profile', 'tickets', 'reservations', 'credits'] as const) {
  test(`a thrown ${failedStage} failure stops later stages while preserving earlier updates`, async () => {
    const failure = new Error(`${failedStage} failed`);
    const order: string[] = [];
    const profileGateway: ProfileDashboardGateway = {
      async loadCurrentProfile() {
        order.push('profile');
        if (failedStage === 'profile') throw failure;
        return { ok: true, profile };
      },
      async loadCredits() {
        order.push('credits');
        if (failedStage === 'credits') throw failure;
        return { ok: true, credits: 5 };
      },
    };
    const ticketsGateway: MyTicketsGateway = {
      async loadMyTickets() {
        order.push('tickets');
        if (failedStage === 'tickets') throw failure;
        return { ok: true, tickets: [ticket(1)] };
      },
    };
    const reservationsGateway: ReservationsGateway = {
      async loadMyReservations() {
        order.push('reservations');
        if (failedStage === 'reservations') throw failure;
        return { ok: true, rows: [reservation(1, 2)] };
      },
    };
    const updates: ProfileDashboardUpdate[] = [];

    await assert.rejects(
      createLoadProfileDashboard(
        profileGateway,
        ticketsGateway,
        reservationsGateway,
        async () => 'token',
      )(update => updates.push(update)),
      caught => caught === failure,
    );

    const expectedOrder = ['profile', 'tickets', 'reservations', 'credits'];
    assert.deepEqual(order, expectedOrder.slice(0, expectedOrder.indexOf(failedStage) + 1));
    assert.equal(updates[0].stage, 'authenticated');
    assert.equal(updates.length, expectedOrder.indexOf(failedStage) + 1);
  });
}

test('token-reader rejection is marked separately and makes no remote calls or updates', async () => {
  const failure = new Error('storage failed');
  let calls = 0;
  const profileGateway: ProfileDashboardGateway = {
    async loadCurrentProfile() { calls++; return { ok: true, profile }; },
    async loadCredits() { calls++; return { ok: true, credits: 0 }; },
  };
  const ticketsGateway: MyTicketsGateway = {
    async loadMyTickets() { calls++; return { ok: true, tickets: [] }; },
  };
  const reservationsGateway: ReservationsGateway = {
    async loadMyReservations() { calls++; return { ok: true, rows: [] }; },
  };
  const updates: ProfileDashboardUpdate[] = [];

  await assert.rejects(
    createLoadProfileDashboard(
      profileGateway,
      ticketsGateway,
      reservationsGateway,
      async () => { throw failure; },
    )(update => updates.push(update)),
    error => error instanceof ProfileDashboardTokenReadError && error.originalError === failure,
  );
  assert.equal(calls, 0);
  assert.deepEqual(updates, []);
});
