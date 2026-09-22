import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CartDisplayData, CartDisplayGateway, CartResourceReservationGateway, ResourceReservationInput } from './ports';
import { createLoadCartDisplayData, createReserveResourcesWithoutTicket } from './useCases';

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
