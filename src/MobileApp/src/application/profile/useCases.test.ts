import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MyTicketRow, MyTicketsGateway } from '../myTickets/ports';
import type { ReservationRow, ReservationsGateway } from '../reservations/ports';
import type {
  CurrentProfileGateway,
  PersonalInfoMutationGateway,
  PersonalInfoUploadFailure,
  ProfileDashboardGateway,
  ProfileDashboardUpdate,
  SavePersonalInfoInput,
} from './ports';
import {
  createLoadPersonalInfo,
  createLoadProfileDashboard,
  createSavePersonalInfo,
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

const baseSaveInput: SavePersonalInfoInput = {
  firstName: '  Ana  ',
  lastName: ' Anic ',
  email: ' ana@example.test ',
  phoneNumber: ' +381601234567 ',
  imageChange: {
    kind: 'keep',
    profilePicture: 'http://example.test/current.jpg',
  },
};

function mutationGateway(
  overrides: Partial<PersonalInfoMutationGateway> = {},
): PersonalInfoMutationGateway {
  return {
    updateProfile: async () => ({ ok: true }),
    uploadProfileImage: async () => ({
      ok: true,
      imageUrl: 'http://example.test/uploaded.jpg',
    }),
    deleteProfileImage: async () => ({ ok: true }),
    ...overrides,
  };
}

test('save with a null or empty initial token performs no mutations', async () => {
  for (const missingToken of [null, '']) {
    let tokenReads = 0;
    let mutations = 0;
    const gateway = mutationGateway({
      updateProfile: async () => { mutations++; return { ok: true }; },
      uploadProfileImage: async () => {
        mutations++;
        return { ok: true, imageUrl: null };
      },
      deleteProfileImage: async () => { mutations++; return { ok: true }; },
    });

    assert.deepEqual(
      await createSavePersonalInfo(
        gateway,
        async () => { tokenReads++; return missingToken; },
      )(baseSaveInput, () => { throw new Error('must not observe upload failure'); }),
      { status: 'missing-token' },
    );
    assert.equal(tokenReads, 1);
    assert.equal(mutations, 0);
  }
});

test('text-only save reads one token and forwards exact unchanged values only to update', async () => {
  let tokenReads = 0;
  const calls: unknown[] = [];
  const gateway = mutationGateway({
    async updateProfile(token, input) {
      calls.push({ operation: 'update', token, input });
      return { ok: true };
    },
    async uploadProfileImage() {
      calls.push({ operation: 'upload' });
      return { ok: true, imageUrl: null };
    },
    async deleteProfileImage() {
      calls.push({ operation: 'delete' });
      return { ok: true };
    },
  });

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => { tokenReads++; return 'primary-token'; },
    )(baseSaveInput, () => { throw new Error('must not observe upload failure'); }),
    {
      status: 'saved',
      profilePicture: 'http://example.test/current.jpg',
    },
  );
  assert.equal(tokenReads, 1);
  assert.deepEqual(calls, [{
    operation: 'update',
    token: 'primary-token',
    input: {
      firstName: '  Ana  ',
      lastName: ' Anic ',
      email: ' ana@example.test ',
      phoneNumber: ' +381601234567 ',
      profilePicture: 'http://example.test/current.jpg',
    },
  }]);
});

test('successful upload reads twice, uploads with second token, then updates with first token', async () => {
  const tokens = ['primary-token', 'upload-token'];
  let tokenReads = 0;
  const order: unknown[] = [];
  const gateway = mutationGateway({
    async uploadProfileImage(token, uri) {
      order.push({ operation: 'upload', token, uri });
      return { ok: true, imageUrl: 'http://example.test/new.jpg' };
    },
    async updateProfile(token, input) {
      order.push({ operation: 'update', token, profilePicture: input.profilePicture });
      return { ok: true };
    },
  });

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => tokens[tokenReads++],
    )(
      { ...baseSaveInput, imageChange: { kind: 'upload', uri: 'file:///photo.jpg' } },
      () => { throw new Error('must not observe upload failure'); },
    ),
    { status: 'saved', profilePicture: 'http://example.test/new.jpg' },
  );
  assert.equal(tokenReads, 2);
  assert.deepEqual(order, [
    {
      operation: 'upload',
      token: 'upload-token',
      uri: 'file:///photo.jpg',
    },
    {
      operation: 'update',
      token: 'primary-token',
      profilePicture: 'http://example.test/new.jpg',
    },
  ]);
});

test('rejected upload is observable once and update still runs with null', async () => {
  const failures: PersonalInfoUploadFailure[] = [];
  const order: unknown[] = [];
  let uploadCalls = 0;
  let updateCalls = 0;
  const gateway = mutationGateway({
    async uploadProfileImage() {
      uploadCalls++;
      order.push('upload');
      return { ok: false, responseText: 'upload rejected' };
    },
    async updateProfile(token, input) {
      updateCalls++;
      order.push({ operation: 'update', token, profilePicture: input.profilePicture });
      return { ok: true };
    },
  });
  let tokenReads = 0;

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => ['primary-token', 'upload-token'][tokenReads++],
    )(
      { ...baseSaveInput, imageChange: { kind: 'upload', uri: 'file:///photo.jpg' } },
      failure => failures.push(failure),
    ),
    { status: 'saved', profilePicture: null },
  );
  assert.equal(tokenReads, 2);
  assert.equal(uploadCalls, 1);
  assert.equal(updateCalls, 1);
  assert.deepEqual(order, [
    'upload',
    { operation: 'update', token: 'primary-token', profilePicture: null },
  ]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].kind, 'error');
  if (failures[0].kind === 'error') {
    assert.equal((failures[0].error as Error).message, 'upload rejected');
  }
});

test('thrown upload failure remains observable and update still runs with null', async () => {
  const failure = new Error('upload network failure');
  const failures: PersonalInfoUploadFailure[] = [];
  let updateCalls = 0;
  const gateway = mutationGateway({
    uploadProfileImage: async () => { throw failure; },
    async updateProfile(_token, input) {
      updateCalls++;
      assert.equal(input.profilePicture, null);
      return { ok: true };
    },
  });
  let tokenReads = 0;

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => ['primary-token', 'upload-token'][tokenReads++],
    )(
      { ...baseSaveInput, imageChange: { kind: 'upload', uri: 'file:///photo.jpg' } },
      observed => failures.push(observed),
    ),
    { status: 'saved', profilePicture: null },
  );
  assert.equal(tokenReads, 2);
  assert.equal(updateCalls, 1);
  assert.deepEqual(failures, [{ kind: 'error', error: failure }]);
});

test('missing second upload token is observable and update still runs with null', async () => {
  const failures: PersonalInfoUploadFailure[] = [];
  let uploadCalls = 0;
  let updateCalls = 0;
  const gateway = mutationGateway({
    uploadProfileImage: async () => {
      uploadCalls++;
      return { ok: true, imageUrl: 'unexpected' };
    },
    async updateProfile(token, input) {
      updateCalls++;
      assert.equal(token, 'primary-token');
      assert.equal(input.profilePicture, null);
      return { ok: true };
    },
  });
  let tokenReads = 0;

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => ['primary-token', null][tokenReads++],
    )(
      { ...baseSaveInput, imageChange: { kind: 'upload', uri: 'file:///photo.jpg' } },
      failure => failures.push(failure),
    ),
    { status: 'saved', profilePicture: null },
  );
  assert.equal(tokenReads, 2);
  assert.equal(uploadCalls, 0);
  assert.equal(updateCalls, 1);
  assert.deepEqual(failures, [{ kind: 'missing-token' }]);
});

test('thrown second upload token read is observable once and update still runs', async () => {
  const failure = new Error('second storage read failed');
  const failures: PersonalInfoUploadFailure[] = [];
  let updateCalls = 0;
  let tokenReads = 0;
  const gateway = mutationGateway({
    async updateProfile(_token, input) {
      updateCalls++;
      assert.equal(input.profilePicture, null);
      return { ok: true };
    },
  });

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => {
        tokenReads++;
        if (tokenReads === 1) return 'primary-token';
        throw failure;
      },
    )(
      { ...baseSaveInput, imageChange: { kind: 'upload', uri: 'file:///photo.jpg' } },
      observed => failures.push(observed),
    ),
    { status: 'saved', profilePicture: null },
  );
  assert.equal(tokenReads, 2);
  assert.equal(updateCalls, 1);
  assert.deepEqual(failures, [{ kind: 'error', error: failure }]);
});

test('successful delete reads twice, deletes with second token, then updates empty picture with first', async () => {
  const order: unknown[] = [];
  let tokenReads = 0;
  const gateway = mutationGateway({
    async deleteProfileImage(token) {
      order.push({ operation: 'delete', token });
      return { ok: true };
    },
    async updateProfile(token, input) {
      order.push({ operation: 'update', token, profilePicture: input.profilePicture });
      return { ok: true };
    },
  });

  assert.deepEqual(
    await createSavePersonalInfo(
      gateway,
      async () => ['primary-token', 'delete-token'][tokenReads++],
    )(
      { ...baseSaveInput, imageChange: { kind: 'delete' } },
      () => { throw new Error('must not observe upload failure'); },
    ),
    { status: 'saved', profilePicture: '' },
  );
  assert.equal(tokenReads, 2);
  assert.deepEqual(order, [
    { operation: 'delete', token: 'delete-token' },
    { operation: 'update', token: 'primary-token', profilePicture: '' },
  ]);
});

test('delete rejection, thrown failure, and missing second token all abort update', async () => {
  const thrownFailure = new Error('delete network failure');
  const cases: Array<{
    secondToken: string | null;
    deleteBehavior: PersonalInfoMutationGateway['deleteProfileImage'];
    expected: unknown;
  }> = [
    {
      secondToken: 'delete-token',
      deleteBehavior: async () => ({ ok: false, responseText: 'delete rejected' }),
      expected: { status: 'delete-rejected', responseText: 'delete rejected' },
    },
    {
      secondToken: null,
      deleteBehavior: async () => { throw new Error('must not call delete'); },
      expected: { status: 'delete-missing-token' },
    },
  ];

  for (const testCase of cases) {
    let tokenReads = 0;
    let deleteCalls = 0;
    let updateCalls = 0;
    const gateway = mutationGateway({
      deleteProfileImage: async token => {
        deleteCalls++;
        assert.equal(token, 'delete-token');
        return testCase.deleteBehavior(token);
      },
      updateProfile: async () => { updateCalls++; return { ok: true }; },
    });

    assert.deepEqual(
      await createSavePersonalInfo(
        gateway,
        async () => ['primary-token', testCase.secondToken][tokenReads++],
      )(
        { ...baseSaveInput, imageChange: { kind: 'delete' } },
        () => { throw new Error('must not observe upload failure'); },
      ),
      testCase.expected,
    );
    assert.equal(tokenReads, 2);
    assert.equal(deleteCalls, testCase.secondToken ? 1 : 0);
    assert.equal(updateCalls, 0);
  }

  let updateCalls = 0;
  const gateway = mutationGateway({
    deleteProfileImage: async () => { throw thrownFailure; },
    updateProfile: async () => { updateCalls++; return { ok: true }; },
  });
  let tokenReads = 0;
  await assert.rejects(
    createSavePersonalInfo(
      gateway,
      async () => ['primary-token', 'delete-token'][tokenReads++],
    )(
      { ...baseSaveInput, imageChange: { kind: 'delete' } },
      () => { throw new Error('must not observe upload failure'); },
    ),
    caught => caught === thrownFailure,
  );
  assert.equal(tokenReads, 2);
  assert.equal(updateCalls, 0);
});

test('update rejection remains distinguishable and thrown update failure propagates without retry', async () => {
  let updateCalls = 0;
  const rejectedGateway = mutationGateway({
    updateProfile: async () => {
      updateCalls++;
      return { ok: false, backendMessage: 'backend message' };
    },
  });

  assert.deepEqual(
    await createSavePersonalInfo(
      rejectedGateway,
      async () => 'primary-token',
    )(baseSaveInput, () => { throw new Error('must not observe upload failure'); }),
    { status: 'update-rejected', backendMessage: 'backend message' },
  );
  assert.equal(updateCalls, 1);

  const failure = new Error('update network failure');
  updateCalls = 0;
  const thrownGateway = mutationGateway({
    updateProfile: async () => { updateCalls++; throw failure; },
  });
  await assert.rejects(
    createSavePersonalInfo(
      thrownGateway,
      async () => 'primary-token',
    )(baseSaveInput, () => { throw new Error('must not observe upload failure'); }),
    caught => caught === failure,
  );
  assert.equal(updateCalls, 1);
});
