import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventListItem } from '../../domain/eventList';
import type { EventListGateway, EventListResponse } from './ports';
import { createLoadEvents } from './useCases';

const now = new Date('2026-09-15T12:00:00.000Z');
const event: EventListItem = {
  id: 1, title: 'Demo', location: 'City', imageUrl: 'images/demo.png',
  startDate: '2026-09-15T10:00:00.000Z', endDate: '2026-09-15T13:00:00.000Z',
  parentEventId: 0,
};

test('successful loading calls gateway once and preserves filtered response order and duplicates', async () => {
  let calls = 0;
  const second = { ...event, id: 2 };
  const gateway: EventListGateway = {
    async getEvents() {
      calls++;
      return { ok: true, events: [second, { ...event, parentEventId: 2 }, event, second] };
    },
  };
  assert.deepEqual(await createLoadEvents(gateway, () => now)(), {
    status: 'loaded', events: [second, event, second],
  });
  assert.equal(calls, 1);
});

test('HTTP rejection preserves status and does not read the clock', async () => {
  const gateway: EventListGateway = { async getEvents() { return { ok: false, statusCode: 503 }; } };
  assert.deepEqual(await createLoadEvents(gateway, () => assert.fail('must not read clock'))(), {
    status: 'request-failed', statusCode: 503,
  });
});

for (const error of [new Error('Network failed'), new SyntaxError('Invalid JSON')]) {
  test(`preserves thrown gateway/parsing failure: ${error.message}`, async () => {
    const gateway: EventListGateway = { async getEvents() { throw error; } };
    const result = await createLoadEvents(gateway, () => assert.fail('must not read clock'))();
    assert.deepEqual(result, { status: 'failure', error });
    if (result.status === 'failure') assert.equal(result.error, error);
  });
}

for (const [label, events] of [
  ['empty response', []],
  ['fully filtered response', [
    { ...event, parentEventId: 1 },
    { ...event, endDate: '2026-09-15T11:00:00.000Z' },
  ]],
] as const) {
  test(`${label} is a successful empty result`, async () => {
    const gateway: EventListGateway = { async getEvents() { return { ok: true, events: [...events] }; } };
    assert.deepEqual(await createLoadEvents(gateway, () => now)(), { status: 'loaded', events: [] });
  });
}

test('reads clock exactly once after gateway resolves, including an inclusive boundary', async () => {
  const calls: string[] = [];
  let resolve!: (response: EventListResponse) => void;
  const gateway: EventListGateway = {
    getEvents() {
      calls.push('gateway');
      return new Promise((done) => { resolve = done; });
    },
  };
  const pending = createLoadEvents(gateway, () => {
    calls.push('clock');
    return now;
  })();
  assert.deepEqual(calls, ['gateway']);
  const boundary = { ...event, endDate: now.toISOString() };
  calls.push('resolved');
  resolve({ ok: true, events: [boundary, event] });
  assert.deepEqual(await pending, { status: 'loaded', events: [boundary, event] });
  assert.deepEqual(calls, ['gateway', 'resolved', 'clock']);
});

test('malformed list data remains a failure rather than becoming an empty success', async () => {
  const gateway: EventListGateway = {
    async getEvents() { return { ok: true, events: null as unknown as EventListItem[] }; },
  };
  const result = await createLoadEvents(gateway, () => now)();
  assert.equal(result.status, 'failure');
  if (result.status === 'failure') assert.ok(result.error instanceof TypeError);
});
