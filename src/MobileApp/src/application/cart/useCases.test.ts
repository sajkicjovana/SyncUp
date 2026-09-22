import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  CartDisplayData, CartDisplayGateway, CartOwnedTicket, CartResourceReservationGateway,
  CartTicketLoadResult, CartTicketPurchaseGateway, ResourceReservationInput,
} from './ports';
import { CartStandardPurchaseError, createLoadCartDisplayData, createPurchaseStandardCart, createReserveResourcesWithoutTicket } from './useCases';

const ticket = { id: 0, name: 'Standard', price: 100 };
const resource = { id: 5, name: 'Chair', price: undefined };
const displayData: CartDisplayData = {
  tickets: [ticket, ticket],
  resources: [resource, resource],
};
const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));

test('forwards exact event ID and token, returning mapped arrays unchanged', async () => {
  const calls: [string | string[], string | null][] = [];
  const gateway: CartDisplayGateway = {
    async loadDisplayData(eventId, token) {
      calls.push([eventId, token]);
      return displayData;
    },
  };

  const result = await createLoadCartDisplayData(gateway)('42', 'token-value');

  assert.deepEqual(calls, [['42', 'token-value']]);
  assert.equal(result, displayData);
  assert.equal(result.tickets, displayData.tickets);
  assert.equal(result.resources, displayData.resources);
  assert.deepEqual(result.tickets, [ticket, ticket]);
  assert.deepEqual(result.resources, [resource, resource]);
});

test('forwards null token and route-array event ID without a guest guard', async () => {
  const eventId = ['42', '43'];
  const calls: [string | string[], string | null][] = [];
  const gateway: CartDisplayGateway = {
    async loadDisplayData(id, token) {
      calls.push([id, token]);
      return displayData;
    },
  };

  assert.equal(await createLoadCartDisplayData(gateway)(eventId, null), displayData);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], eventId);
  assert.equal(calls[0][1], null);
});

test('propagates gateway failure unchanged', async () => {
  const error = new Error('Display load failed');
  const gateway: CartDisplayGateway = {
    async loadDisplayData() { throw error; },
  };

  await assert.rejects(
    createLoadCartDisplayData(gateway)('42', 'token-value'),
    caught => caught === error,
  );
});

test('resource-only reservation with no IDs completes without a gateway call', async () => {
  let calls = 0;
  const gateway: CartResourceReservationGateway = {
    async reserveResource() { calls++; },
  };

  await createReserveResourcesWithoutTicket(gateway)([], 'token-value');
  assert.equal(calls, 0);
});

test('resource-only reservation forwards one exact semantic input', async () => {
  const calls: ResourceReservationInput[] = [];
  const gateway: CartResourceReservationGateway = {
    async reserveResource(input) { calls.push(input); },
  };

  await createReserveResourcesWithoutTicket(gateway)([7], 'token-value');
  assert.deepEqual(calls, [{ resourceId: 7, quantity: 1, userTicketId: null, token: 'token-value' }]);
});

test('resource-only reservations stay sequential and retain duplicate IDs and order', async () => {
  const calls: ResourceReservationInput[] = [];
  let finishFirst!: () => void;
  let finishSecond!: () => void;
  const gateway: CartResourceReservationGateway = {
    async reserveResource(input) {
      calls.push(input);
      if (calls.length === 1) await new Promise<void>(resolve => { finishFirst = resolve; });
      if (calls.length === 2) await new Promise<void>(resolve => { finishSecond = resolve; });
    },
  };

  const reserving = createReserveResourcesWithoutTicket(gateway)([7, 7, 9], 'token-value');
  const expected = (resourceId: number) => ({ resourceId, quantity: 1, userTicketId: null, token: 'token-value' });
  assert.deepEqual(calls, [expected(7)]);

  finishFirst();
  await nextTurn();
  assert.deepEqual(calls, [expected(7), expected(7)]);

  finishSecond();
  await nextTurn();
  assert.deepEqual(calls, [expected(7), expected(7), expected(9)]);
  await reserving;
});

test('first reservation failure propagates and prevents later calls', async () => {
  const error = new Error('First reservation failed');
  const calls: number[] = [];
  const gateway: CartResourceReservationGateway = {
    async reserveResource(input) { calls.push(input.resourceId); throw error; },
  };

  await assert.rejects(
    createReserveResourcesWithoutTicket(gateway)([1, 2, 3], 'token-value'),
    caught => caught === error,
  );
  assert.deepEqual(calls, [1]);
});

test('middle reservation failure leaves earlier completion and prevents later calls', async () => {
  const error = new Error('Second reservation failed');
  const started: number[] = [];
  const completed: number[] = [];
  const gateway: CartResourceReservationGateway = {
    async reserveResource(input) {
      started.push(input.resourceId);
      if (input.resourceId === 2) throw error;
      completed.push(input.resourceId);
    },
  };

  await assert.rejects(
    createReserveResourcesWithoutTicket(gateway)([1, 2, 3], 'token-value'),
    caught => caught === error,
  );
  assert.deepEqual(started, [1, 2]);
  assert.deepEqual(completed, [1]);
});

const owned = (userTicketId: CartOwnedTicket['userTicketId'], eventId: CartOwnedTicket['eventId'] = 5): CartOwnedTicket => ({
  userTicketId, eventId, validationToken: `validation-${userTicketId}`,
});
const loaded = (tickets: CartOwnedTicket[]): CartTicketLoadResult => ({ kind: 'loaded', tickets });
const standardInput = {
  eventId: 5,
  selectedTickets: [{ id: 2, quantity: 3 }, { id: 2, quantity: 1 }, { id: 4, quantity: 0 }],
  selectedResourceIds: [9, 9, 8],
  token: 'held-token',
};

test('standard purchase preserves workflow order, ticket selections, inferred duplicates, and sequential resources', async () => {
  const calls: string[] = [];
  const selections: unknown[] = [];
  const resources: ResourceReservationInput[] = [];
  let loads = 0;
  let finishFirst!: () => void;
  let finishSecond!: () => void;
  const ticketGateway: CartTicketPurchaseGateway = {
    async loadMyTickets(token) {
      calls.push(`load:${token}`);
      return ++loads === 1 ? loaded([owned(1)]) : loaded([owned(1), owned(30), owned(30), owned(31), owned(32, 6)]);
    },
    async purchaseTickets(input, token) {
      calls.push(`purchase:${token}`);
      selections.push(...input);
      return { kind: 'accepted' };
    },
  };
  const resourceGateway: CartResourceReservationGateway = {
    async reserveResource(input) {
      resources.push(input);
      calls.push(`reserve:${input.resourceId}`);
      if (resources.length === 1) await new Promise<void>(resolve => { finishFirst = resolve; });
      if (resources.length === 2) await new Promise<void>(resolve => { finishSecond = resolve; });
    },
  };

  const operation = createPurchaseStandardCart(ticketGateway, resourceGateway)(standardInput);
  await nextTurn();
  assert.deepEqual(calls, ['load:held-token', 'purchase:held-token', 'load:held-token', 'reserve:9']);
  assert.deepEqual(selections, [
    { ticketId: 2, quantity: 3 }, { ticketId: 2, quantity: 1 }, { ticketId: 4, quantity: 0 },
  ]);
  assert.deepEqual(resources, [{ resourceId: 9, quantity: 1, userTicketId: 30, token: 'held-token' }]);

  finishFirst();
  await nextTurn();
  assert.deepEqual(calls.slice(-2), ['reserve:9', 'reserve:9']);
  finishSecond();
  await nextTurn();
  assert.deepEqual(calls, ['load:held-token', 'purchase:held-token', 'load:held-token', 'reserve:9', 'reserve:9', 'reserve:8']);
  assert.deepEqual(resources, [
    { resourceId: 9, quantity: 1, userTicketId: 30, token: 'held-token' },
    { resourceId: 9, quantity: 1, userTicketId: 30, token: 'held-token' },
    { resourceId: 8, quantity: 1, userTicketId: 30, token: 'held-token' },
  ]);
  assert.deepEqual(await operation, [
    { userTicketId: 30, validationToken: 'validation-30' },
    { userTicketId: 30, validationToken: 'validation-30' },
    { userTicketId: 31, validationToken: 'validation-31' },
  ]);
});

test('standard flow skips purchase for no selections but still loads after and reserves with null for zero inferred', async () => {
  const calls: string[] = [];
  const ticketGateway: CartTicketPurchaseGateway = {
    async loadMyTickets() { calls.push('load'); return loaded([owned(1)]); },
    async purchaseTickets() { calls.push('purchase'); return { kind: 'accepted' }; },
  };
  const resourceGateway: CartResourceReservationGateway = {
    async reserveResource(input) { calls.push(`reserve:${input.userTicketId}`); },
  };
  const result = await createPurchaseStandardCart(ticketGateway, resourceGateway)({
    ...standardInput, selectedTickets: [], selectedResourceIds: [9],
  });
  assert.deepEqual(calls, ['load', 'load', 'reserve:null']);
  assert.deepEqual(result, []);
});

test('standard flow skips resources when none selected and uses strict event and Set ID semantics', async () => {
  let loads = 0;
  let resourceCalls = 0;
  const ticketGateway: CartTicketPurchaseGateway = {
    async loadMyTickets() {
      return ++loads === 1
        ? loaded([owned(1), owned(undefined)])
        : loaded([owned('1'), owned(1), owned(2, '5'), owned(undefined), owned(3), owned(4, 6)]);
    },
    async purchaseTickets() { return { kind: 'accepted' }; },
  };
  const resourceGateway: CartResourceReservationGateway = {
    async reserveResource() { resourceCalls++; },
  };
  const result = await createPurchaseStandardCart(ticketGateway, resourceGateway)({
    ...standardInput, selectedResourceIds: [],
  });
  assert.deepEqual(result, [
    { userTicketId: '1', validationToken: 'validation-1' },
    { userTicketId: 3, validationToken: 'validation-3' },
  ]);
  assert.equal(resourceCalls, 0);
});

test('missing ID remains undefined when first inferred row is used for a resource', async () => {
  let loads = 0;
  const resources: ResourceReservationInput[] = [];
  const ticketGateway: CartTicketPurchaseGateway = {
    async loadMyTickets() { return ++loads === 1 ? loaded([]) : loaded([owned(undefined)]); },
    async purchaseTickets() { return { kind: 'accepted' }; },
  };
  const resourceGateway: CartResourceReservationGateway = {
    async reserveResource(input) { resources.push(input); },
  };
  const result = await createPurchaseStandardCart(ticketGateway, resourceGateway)(standardInput);
  assert.deepEqual(resources, standardInput.selectedResourceIds.map(resourceId => ({
    resourceId, quantity: 1, userTicketId: undefined, token: 'held-token',
  })));
  assert.deepEqual(result, [{ userTicketId: undefined, validationToken: 'validation-undefined' }]);
});

test('ticket rejections retain their exact stage and stop later work', async () => {
  for (const stage of ['beforeTickets', 'purchase', 'afterTickets'] as const) {
    const calls: string[] = [];
    let loads = 0;
    const ticketGateway: CartTicketPurchaseGateway = {
      async loadMyTickets() {
        calls.push('load');
        loads++;
        return stage === 'beforeTickets' && loads === 1 || stage === 'afterTickets' && loads === 2
          ? { kind: 'rejected' } : loaded([]);
      },
      async purchaseTickets() {
        calls.push('purchase');
        return stage === 'purchase' ? { kind: 'rejected', responseText: 'exact backend text' } : { kind: 'accepted' };
      },
    };
    const resourceGateway: CartResourceReservationGateway = {
      async reserveResource() { calls.push('reserve'); },
    };
    await assert.rejects(
      createPurchaseStandardCart(ticketGateway, resourceGateway)(standardInput),
      error => error instanceof CartStandardPurchaseError
        && error.stage === stage
        && error.responseText === (stage === 'purchase' ? 'exact backend text' : undefined),
    );
    assert.deepEqual(calls, stage === 'beforeTickets' ? ['load'] : stage === 'purchase' ? ['load', 'purchase'] : ['load', 'purchase', 'load']);
  }
});

test('native gateway errors at every ticket stage propagate unchanged', async () => {
  for (const stage of ['before', 'purchase', 'after'] as const) {
    const error = new SyntaxError(`${stage} failed`);
    let loads = 0;
    let resources = 0;
    const ticketGateway: CartTicketPurchaseGateway = {
      async loadMyTickets() {
        loads++;
        if (stage === 'before' && loads === 1 || stage === 'after' && loads === 2) throw error;
        return loaded([]);
      },
      async purchaseTickets() {
        if (stage === 'purchase') throw error;
        return { kind: 'accepted' };
      },
    };
    const resourceGateway: CartResourceReservationGateway = {
      async reserveResource() { resources++; },
    };
    await assert.rejects(createPurchaseStandardCart(ticketGateway, resourceGateway)(standardInput), caught => caught === error);
    assert.equal(resources, 0);
  }
});

test('first or later resource failure stops further calls without rollback', async () => {
  for (const failAt of [1, 2]) {
    const error = new Error('reservation failed');
    const started: number[] = [];
    const completed: number[] = [];
    const ticketGateway: CartTicketPurchaseGateway = {
      async loadMyTickets() { return loaded([]); },
      async purchaseTickets() { return { kind: 'accepted' }; },
    };
    const resourceGateway: CartResourceReservationGateway = {
      async reserveResource(input) {
        started.push(input.resourceId);
        if (started.length === failAt) throw error;
        completed.push(input.resourceId);
      },
    };
    await assert.rejects(
      createPurchaseStandardCart(ticketGateway, resourceGateway)(standardInput), caught => caught === error,
    );
    assert.deepEqual(started, standardInput.selectedResourceIds.slice(0, failAt));
    assert.deepEqual(completed, standardInput.selectedResourceIds.slice(0, failAt - 1));
  }
});
