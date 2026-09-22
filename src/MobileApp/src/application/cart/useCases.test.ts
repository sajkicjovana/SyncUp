import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CartDisplayData, CartDisplayGateway } from './ports';
import { createLoadCartDisplayData } from './useCases';

const ticket = { id: 0, name: 'Standard', price: 100 };
const resource = { id: 5, name: 'Chair', price: undefined };
const displayData: CartDisplayData = {
  tickets: [ticket, ticket],
  resources: [resource, resource],
};

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
