import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketSelectionGateway, TicketSelectionOptions } from './ports';
import { createLoadTicketSelectionOptions } from './useCases';

const ticket = { id: 0, name: 'Standard', price: 0, available: 2 };
const resource = { id: 5, name: 'Chair', price: undefined, quantity: 3, measure: undefined as unknown as string };
const options: TicketSelectionOptions = {
  tickets: [ticket, ticket],
  resources: [resource, resource],
};

test('reads token once, forwards exact event ID and token, and returns arrays unchanged', async () => {
  let reads = 0;
  const calls: [string, string | null][] = [];
  const gateway: TicketSelectionGateway = {
    async loadOptions(eventId, token) {
      calls.push([eventId, token]);
      return options;
    },
  };

  const result = await createLoadTicketSelectionOptions(gateway, async () => {
    reads++;
    return 'token-value';
  })('42');

  assert.equal(reads, 1);
  assert.deepEqual(calls, [['42', 'token-value']]);
  assert.equal(result, options);
  assert.equal(result.tickets, options.tickets);
  assert.equal(result.resources, options.resources);
  assert.deepEqual(result.tickets, [ticket, ticket]);
  assert.deepEqual(result.resources, [resource, resource]);
});

test('null token is forwarded unchanged and does not skip the gateway', async () => {
  let reads = 0;
  const calls: [string, string | null][] = [];
  const gateway: TicketSelectionGateway = {
    async loadOptions(eventId, token) {
      calls.push([eventId, token]);
      return options;
    },
  };

  const result = await createLoadTicketSelectionOptions(gateway, async () => {
    reads++;
    return null;
  })('7');

  assert.equal(reads, 1);
  assert.deepEqual(calls, [['7', null]]);
  assert.equal(result, options);
});

test('token-reader failure propagates without calling the gateway', async () => {
  const error = new Error('Storage failed');
  let calls = 0;
  const gateway: TicketSelectionGateway = {
    async loadOptions() { calls++; return options; },
  };

  await assert.rejects(
    createLoadTicketSelectionOptions(gateway, async () => { throw error; })('42'),
    caught => caught === error,
  );
  assert.equal(calls, 0);
});

test('gateway failure propagates unchanged', async () => {
  const error = new Error('Options request failed');
  const gateway: TicketSelectionGateway = {
    async loadOptions() { throw error; },
  };

  await assert.rejects(
    createLoadTicketSelectionOptions(gateway, async () => 'token')('42'),
    caught => caught === error,
  );
});
