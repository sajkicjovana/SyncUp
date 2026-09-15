import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SearchCriteria, SearchEvent } from '../../domain/search';
import type { SearchGateway } from './ports';
import { createSearchUseCases, prepareSearchParameters } from './useCases';

const criteria: SearchCriteria = {
  searchQuery: '', selectedLocation: null, selectedCategory: null,
  startDate: null, endDate: null, sortBy: 'popularity',
};
const event: SearchEvent = { id: 1, title: 'Demo', location: 'City', startDate: '', imageUrl: '' };
const unused = async (): Promise<SearchEvent[]> => { throw new Error('Unexpected gateway operation'); };

for (const [sortBy, expected] of [
  ['popularity', [['sortBy', 'popularity'], ['sortOrder', 'desc']]],
  ['priceAsc', [['sortBy', 'price'], ['sortOrder', 'asc']]],
  ['priceDesc', [['sortBy', 'price'], ['sortOrder', 'desc']]],
  ['dateAsc', [['sortBy', 'startDate'], ['sortOrder', 'asc']]],
  ['dateDesc', [['sortBy', 'startDate'], ['sortOrder', 'desc']]],
  ['', []], ['unknown', []], ['Popularity', []],
] as const) {
  test(`sort mapping: ${sortBy || 'empty'}`, () => {
    assert.deepEqual(prepareSearchParameters({ ...criteria, sortBy }), expected);
  });
}

test('default criteria omit optional parameters and retain popularity descending', () => {
  assert.deepEqual(prepareSearchParameters(criteria), [['sortBy', 'popularity'], ['sortOrder', 'desc']]);
  assert.deepEqual(prepareSearchParameters({ ...criteria, sortBy: '', selectedLocation: '', selectedCategory: '' }), []);
});

test('criteria preserve exact text, location, category, ISO instants and parameter order', () => {
  const input = { ...criteria, searchQuery: ' A+B & Č ', selectedLocation: ' City ', selectedCategory: 'Music',
    startDate: new Date('2026-09-16T18:25:13.123+02:00'), endDate: new Date('2026-09-15T01:00:00+02:00') };
  assert.deepEqual(prepareSearchParameters(input), [
    ['name', ' A+B & Č '], ['location', ' City '],
    ['startDate', '2026-09-16T16:25:13.123Z'], ['endDate', '2026-09-14T23:00:00.000Z'],
    ['sortBy', 'popularity'], ['sortOrder', 'desc'], ['category', 'Music'],
  ]);
  assert.equal(input.startDate.toISOString(), '2026-09-16T16:25:13.123Z');
});

test('whitespace criteria remain present and Free-only is never sent', () => {
  const input = { ...criteria, searchQuery: ' ', selectedLocation: ' ', isFree: true };
  assert.deepEqual(prepareSearchParameters(input), [
    ['name', ' '], ['location', ' '], ['sortBy', 'popularity'], ['sortOrder', 'desc'],
  ]);
});

test('invalid date still fails during preparation before the gateway is called', () => {
  const useCases = createSearchUseCases({ search: unused, getLocationEvents: unused });
  assert.throws(() => useCases.loadSearchEvents({ ...criteria, startDate: new Date('invalid') }), RangeError);
});

test('search calls gateway once with prepared values and preserves returned array, order and duplicates', async () => {
  const events = [{ ...event, id: 2 }, event, event];
  let calls = 0;
  const gateway: SearchGateway = {
    async search(params) {
      calls++;
      assert.deepEqual(params, prepareSearchParameters(criteria));
      return events;
    },
    getLocationEvents: unused,
  };
  const result = await createSearchUseCases(gateway).loadSearchEvents(criteria);
  assert.equal(calls, 1);
  assert.equal(result, events);
});

test('empty search and location results remain empty', async () => {
  const useCases = createSearchUseCases({ search: async () => [], getLocationEvents: async () => [] });
  assert.deepEqual(await useCases.loadSearchEvents(criteria), []);
  assert.deepEqual(await useCases.loadLocations(), []);
});

for (const operation of ['search', 'locations'] as const) {
  for (const error of [new Error('Network failure'), new SyntaxError('JSON failure')]) {
    test(`${operation} preserves original ${error.message}`, async () => {
      const fail = async () => { throw error; };
      const useCases = createSearchUseCases({ search: fail, getLocationEvents: fail });
      await assert.rejects(operation === 'search' ? useCases.loadSearchEvents(criteria) : useCases.loadLocations(),
        actual => actual === error);
    });
  }
}

test('location loading calls its gateway once and only projects unique truthy locations', async () => {
  let calls = 0;
  const useCases = createSearchUseCases({ search: unused, getLocationEvents: async () => {
    calls++;
    return ['B', 'A', 'B', '', 'a', ' '].map(location => ({ ...event, location, parentEventId: 5, endDate: '2000-01-01' }));
  } });
  assert.deepEqual(await useCases.loadLocations(), ['B', 'A', 'a', ' ']);
  assert.equal(calls, 1);
});
