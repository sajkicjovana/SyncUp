import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventDetails } from '../../domain/eventDetails';
import type { EventDetailsGateway } from './ports';
import { createLoadEventDetails } from './useCases';

const eventDetails: EventDetails = {
  id: 42,
  title: 'Demo event',
  imageUrl: 'images/demo.png',
  location: 'City',
  startDate: '2026-09-16T10:00:00.000Z',
  endDate: '2026-09-16T12:00:00.000Z',
  description: 'Description',
  organizerId: 7,
  organizerName: 'Organizer',
  attendingCount: 3,
  isFavorite: false,
  minPrice: null,
  maxPrice: 0,
};

function setup(loadEventDetails: EventDetailsGateway['loadEventDetails'] = async () => eventDetails) {
  const calls: unknown[][] = [];
  const gateway: EventDetailsGateway = {
    async loadEventDetails(eventId, token) {
      calls.push([eventId, token]);
      return loadEventDetails(eventId, token);
    },
  };
  return { calls, loadEventDetails: createLoadEventDetails(gateway) };
}

test('event details loading calls the gateway once with the exact ID and token', async () => {
  const { calls, loadEventDetails } = setup();
  await loadEventDetails('42', 'token-value');
  assert.deepEqual(calls, [['42', 'token-value']]);
});

test('event details loading preserves undefined and null tokens', async () => {
  const undefinedToken = setup();
  await undefinedToken.loadEventDetails('42', undefined);
  assert.deepEqual(undefinedToken.calls, [['42', undefined]]);

  const nullToken = setup();
  await nullToken.loadEventDetails('42', null);
  assert.deepEqual(nullToken.calls, [['42', null]]);
});

test('event details loading returns the exact response object unchanged', async () => {
  const { loadEventDetails } = setup();
  const result = await loadEventDetails('42', 'token-value');
  assert.equal(result, eventDetails);
});

test('event details loading does not derive isFree or transform the response', async () => {
  const input = { ...eventDetails, minPrice: 0, maxPrice: 0 };
  const { loadEventDetails } = setup(async () => input);
  const result = await loadEventDetails('42');
  assert.equal(result, input);
  assert.equal('isFree' in result, false);
  assert.deepEqual(result, input);
});

test('event details loading propagates gateway rejection unchanged', async () => {
  const error = new Error('Event details request failed');
  const { loadEventDetails } = setup(async () => { throw error; });
  await assert.rejects(loadEventDetails('42'), (caught) => caught === error);
});
