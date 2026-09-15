import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectBrowsableEvents } from './eventList';
import type { EventListItem } from './eventList';

const now = new Date('2026-09-15T12:00:00.000Z');
const event: EventListItem = {
  id: 1, title: 'Demo', location: 'City', imageUrl: 'images/demo.png',
  startDate: '2026-09-15T10:00:00.000Z', endDate: '2026-09-15T13:00:00.000Z',
  parentEventId: 0,
};

for (const parentEventId of [0, '0', null, '', '   ']) {
  test(`includes root parent ${JSON.stringify(parentEventId)} using baseline coercion`, () => {
    const item = { ...event, parentEventId };
    assert.deepEqual(selectBrowsableEvents([item], now), [item]);
  });
}

for (const parentEventId of [1, '1', -1, undefined, 'invalid']) {
  test(`excludes non-root/missing parent ${String(parentEventId)}`, () => {
    assert.deepEqual(selectBrowsableEvents([{ ...event, parentEventId }], now), []);
  });
}

for (const [label, endDate, included] of [
  ['past', '2026-09-15T11:59:59.999Z', false],
  ['future', '2026-09-15T12:00:00.001Z', true],
  ['exactly now', '2026-09-15T12:00:00.000Z', true],
  ['invalid', 'invalid-date', false],
] as const) {
  test(`${label} end date preserves inclusive boundary`, () => {
    const item = { ...event, endDate };
    assert.deepEqual(selectBrowsableEvents([item], now), included ? [item] : []);
  });
}

test('empty input returns an empty result', () => {
  assert.deepEqual(selectBrowsableEvents([], now), []);
});

test('preserves response order, duplicates, object identity, and input without sorting', () => {
  const later = Object.freeze({ ...event, id: 3, startDate: '2026-09-16T12:00:00.000Z' });
  const earlier = Object.freeze({ ...event, id: 2 });
  const child = Object.freeze({ ...event, id: 4, parentEventId: 3 });
  const input = [later, child, earlier, later];
  const snapshot = [...input];
  Object.freeze(input);
  const result = selectBrowsableEvents(input, now);
  assert.deepEqual(result, [later, earlier, later]);
  assert.equal(result[0], later);
  assert.equal(result[1], earlier);
  assert.equal(result[2], later);
  assert.notEqual(result, input);
  assert.deepEqual(input, snapshot);
});

test('start date never affects eligibility', () => {
  const input = ['2020-01-01', '2030-01-01', 'invalid-date'].map((startDate) => ({ ...event, startDate }));
  assert.deepEqual(selectBrowsableEvents(input, now), input);
});
