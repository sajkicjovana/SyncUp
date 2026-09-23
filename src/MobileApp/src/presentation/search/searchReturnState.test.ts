import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  captureSearchReturnState,
  clearSearchReturnState,
  consumeSearchReturnState,
  type SearchReturnSnapshot,
} from './searchReturnState';

afterEach(() => clearSearchReturnState());

function createSnapshot(): SearchReturnSnapshot {
  return {
    searchQuery: 'conference',
    selectedLocation: 'Belgrade',
    selectedCategory: 'Business',
    startDate: new Date('2026-10-02T00:00:00.000Z'),
    endDate: new Date('2026-10-03T00:00:00.000Z'),
    isFree: true,
    sortBy: 'priceAsc',
    events: [{
      id: 42,
      title: 'Conference',
      startDate: '2026-10-02T10:00:00.000Z',
      location: 'Belgrade',
      minPrice: 0,
      maxPrice: 0,
      imageUrl: 'images/conference.jpg',
    }],
    eventPrices: { 42: { minPrice: 0, maxPrice: 0 } },
    locations: [{ label: 'Belgrade', value: 'Belgrade' }],
  };
}

test('capture returns a usable key and matching consume preserves exact snapshot identity', () => {
  const snapshot = createSnapshot();
  const key = captureSearchReturnState(snapshot);

  assert.equal(typeof key, 'string');
  assert.notEqual(key, '');
  assert.equal(consumeSearchReturnState(key), snapshot);
  assert.equal(snapshot.startDate instanceof Date, true);
  assert.equal(snapshot.endDate instanceof Date, true);
  assert.equal(snapshot.events[0].id, 42);
  assert.equal(snapshot.eventPrices[42].minPrice, 0);
});

test('matching consume is one-shot', () => {
  const key = captureSearchReturnState(createSnapshot());

  assert.notEqual(consumeSearchReturnState(key), null);
  assert.equal(consumeSearchReturnState(key), null);
});

test('wrong key neither returns nor consumes the pending snapshot', () => {
  const snapshot = createSnapshot();
  const key = captureSearchReturnState(snapshot);

  assert.equal(consumeSearchReturnState('wrong-key'), null);
  assert.equal(consumeSearchReturnState(key), snapshot);
});

test('newer capture replaces an abandoned older snapshot', () => {
  const olderKey = captureSearchReturnState(createSnapshot());
  const newerSnapshot = createSnapshot();
  newerSnapshot.searchQuery = 'new query';
  const newerKey = captureSearchReturnState(newerSnapshot);

  assert.notEqual(newerKey, olderKey);
  assert.equal(consumeSearchReturnState(olderKey), null);
  assert.equal(consumeSearchReturnState(newerKey), newerSnapshot);
});

test('explicit clear removes the pending snapshot', () => {
  const key = captureSearchReturnState(createSnapshot());

  clearSearchReturnState();

  assert.equal(consumeSearchReturnState(key), null);
});
