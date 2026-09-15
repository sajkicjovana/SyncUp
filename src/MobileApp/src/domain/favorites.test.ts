import assert from 'node:assert/strict';
import { test } from 'node:test';
import { favoriteIds, favoriteIntent } from './favorites';
import type { FavoriteEvent } from './favorites';

test('ID projection preserves order and duplicates without mutation', () => {
  const make = (id: number): FavoriteEvent => Object.freeze({
    id, title: 'Demo', location: 'City', imageUrl: 'image.png', startDate: '2020-01-01', attendingCount: 0,
  });
  const events = [make(3), make(1), make(3)];
  Object.freeze(events);
  assert.deepEqual(favoriteIds(events), [3, 1, 3]);
  assert.deepEqual(events.map((event) => event.id), [3, 1, 3]);
});

test('empty collection produces empty IDs', () => {
  assert.deepEqual(favoriteIds([]), []);
});

test('existing ID selects removal', () => {
  assert.equal(favoriteIntent([1, 2], 2), 'remove');
});

test('absent ID selects addition', () => {
  assert.equal(favoriteIntent([1, 2], 3), 'add');
});

test('membership does not coerce IDs', () => {
  assert.equal(favoriteIntent(['2'] as unknown as number[], 2), 'add');
  assert.equal(favoriteIntent([2], '2' as unknown as number), 'add');
});
