import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectFreeSearchEvents, uniqueSearchLocations } from './search';
import type { SearchEvent, SearchPrice } from './search';

const event: SearchEvent = { id: 1, title: 'Demo', location: 'City', startDate: '2020-01-01', imageUrl: '' };

test('empty events produce no free events or locations', () => {
  assert.deepEqual(selectFreeSearchEvents([], {}), []);
  assert.deepEqual(uniqueSearchLocations([]), []);
});

test('missing price entry excludes an event even with prices on the event itself', () => {
  assert.deepEqual(selectFreeSearchEvents([{ ...event, minPrice: 0, maxPrice: 0 }], {}), []);
});

for (const [label, price, included] of [
  ['zero prices', { minPrice: 0, maxPrice: 0 }, true],
  ['null prices', { minPrice: null, maxPrice: null }, true],
  ['undefined prices', {}, true],
  ['mixed null and undefined', { minPrice: null }, true],
  ['mixed zero and null', { minPrice: 0, maxPrice: null }, true],
  ['paid range', { minPrice: 10, maxPrice: 20 }, false],
  ['equal paid prices', { minPrice: 10, maxPrice: 10 }, false],
  ['mixed zero and paid', { minPrice: 0, maxPrice: 20 }, false],
  ['negative prices', { minPrice: -1, maxPrice: -1 }, false],
  ['string zero is not coerced', { minPrice: '0', maxPrice: '0' }, false],
  ['other falsy values', { minPrice: '', maxPrice: false }, true],
] as const) {
  test(`free predicate preserves ${label}`, () => {
    // Characterize unvalidated JSON values as well as the declared API shape.
    const result = selectFreeSearchEvents([event], { 1: price as SearchPrice });
    assert.deepEqual(result, included ? [event] : []);
  });
}

test('free filtering preserves order, duplicates and references without mutating inputs', () => {
  const second = Object.freeze({ ...event, id: 2 });
  const input = [second, event, second, { ...event, id: 3 }];
  const before = [...input];
  Object.freeze(input);
  const prices = Object.freeze({ 1: Object.freeze({ minPrice: 0, maxPrice: 0 }), 2: Object.freeze({}) });
  const result = selectFreeSearchEvents(input, prices);
  assert.deepEqual(result, [second, event, second]);
  assert.equal(result[0], second);
  assert.equal(result[1], event);
  assert.equal(result[2], second);
  assert.deepEqual(input, before);
});

test('free filtering adds no root, date, category or text rules', () => {
  const unusual = { ...event, parentEventId: 99, endDate: '2000-01-01', startDate: 'invalid', category: 'Other', title: '' };
  assert.deepEqual(selectFreeSearchEvents([unusual], { 1: {} }), [unusual]);
});

test('locations preserve first occurrence and exact case/whitespace distinctions', () => {
  const input = ['City', ' city ', 'City', 'city', ' ', 'Other'].map(location => ({ ...event, location }));
  const before = input.map(item => ({ ...item }));
  input.forEach(Object.freeze);
  Object.freeze(input);
  assert.deepEqual(uniqueSearchLocations(input), ['City', ' city ', 'city', ' ', 'Other']);
  assert.deepEqual(input, before);
});

test('locations remove every falsy value without filtering events by dates or parent', () => {
  const input = ['', null, undefined, false, 0, NaN, 'City'].map(location => ({ ...event, location, parentEventId: 5 }));
  assert.deepEqual(uniqueSearchLocations(input as SearchEvent[]), ['City']);
});
