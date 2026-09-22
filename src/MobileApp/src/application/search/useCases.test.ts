import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SearchCriteria, SearchEvent, SearchPrice } from '../../domain/search';
import type { SearchGateway } from './ports';
import { createSearchUseCases } from './useCases';

const criteria: SearchCriteria = {
  searchQuery: '', selectedLocation: null, selectedCategory: null,
  startDate: null, endDate: null, sortBy: 'popularity',
};
const event: SearchEvent = { id: 1, title: 'Demo', location: 'City', startDate: '', imageUrl: '' };
const unused = async (): Promise<SearchEvent[]> => { throw new Error('Unexpected gateway operation'); };
const unusedPrice = async (): Promise<SearchPrice> => { throw new Error('Unexpected price operation'); };

test('search forwards semantic criteria unchanged and preserves result identity, order and duplicates', async () => {
  const input: SearchCriteria = {
    ...criteria,
    searchQuery: ' A+B & ',
    selectedLocation: ' City ',
    selectedCategory: 'Music',
    startDate: new Date('2026-09-16T16:25:13.123Z'),
    endDate: new Date('2026-09-17T16:25:13.123Z'),
    sortBy: 'priceAsc',
  };
  const events = [{ ...event, id: 2 }, event, event];
  let calls = 0;
  const gateway: SearchGateway = {
    async search(received) {
      calls++;
      assert.equal(received, input);
      return events;
    },
    getLocationEvents: unused,
    getEventPrice: unusedPrice,
  };

  const result = await createSearchUseCases(gateway).loadSearchEvents(input);

  assert.equal(calls, 1);
  assert.equal(result, events);
  assert.deepEqual(result, [{ ...event, id: 2 }, event, event]);
});

test('empty search and location results remain empty', async () => {
  const useCases = createSearchUseCases({ search: async () => [], getLocationEvents: async () => [], getEventPrice: unusedPrice });
  assert.deepEqual(await useCases.loadSearchEvents(criteria), []);
  assert.deepEqual(await useCases.loadLocations(), []);
});

for (const operation of ['search', 'locations'] as const) {
  for (const error of [new Error('Network failure'), new SyntaxError('JSON failure')]) {
    test(`${operation} preserves original ${error.message}`, async () => {
      const fail = async () => { throw error; };
      const useCases = createSearchUseCases({ search: fail, getLocationEvents: fail, getEventPrice: fail });
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
  }, getEventPrice: unusedPrice });
  assert.deepEqual(await useCases.loadLocations(), ['B', 'A', 'a', ' ']);
  assert.equal(calls, 1);
});

test('price loading delegates exactly once and preserves the event ID and returned value', async () => {
  const price = { minPrice: 0, maxPrice: undefined };
  let calls = 0;
  let receivedId = 0;
  const useCases = createSearchUseCases({
    search: unused,
    getLocationEvents: unused,
    async getEventPrice(eventId) {
      calls++;
      receivedId = eventId;
      return price;
    },
  });

  const result = await useCases.loadEventPrice(42);

  assert.equal(calls, 1);
  assert.equal(receivedId, 42);
  assert.equal(result, price);
  assert.deepEqual(result, { minPrice: 0, maxPrice: undefined });
});

test('price loading preserves empty and falsy price fields', async () => {
  const price = { minPrice: null, maxPrice: 0 };
  const useCases = createSearchUseCases({
    search: unused,
    getLocationEvents: unused,
    getEventPrice: async () => price,
  });

  assert.equal(await useCases.loadEventPrice(7), price);
});

test('price loading propagates gateway rejection unchanged', async () => {
  const error = new Error('Price request failed');
  const useCases = createSearchUseCases({
    search: unused,
    getLocationEvents: unused,
    getEventPrice: async () => { throw error; },
  });

  await assert.rejects(useCases.loadEventPrice(9), (caught) => caught === error);
});
