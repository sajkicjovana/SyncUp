import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventPin, PinCategory } from '../../domain/eventPins';
import type { EventPinsGateway } from './ports';
import { createEventPinsUseCases } from './useCases';

const pin: EventPin = {
  id: 1,
  eventId: 42,
  latitude: 44.8,
  longitude: 20.4,
  label: 'Entrance',
  description: 'Main entrance',
  pinnedAt: '2026-09-16T10:00:00.000Z',
  pinCategory: 2,
};
const category: PinCategory = { id: 2, name: 'Entrance' };

function setup(overrides: Partial<EventPinsGateway> = {}) {
  const calls: unknown[][] = [];
  const gateway: EventPinsGateway = {
    async loadEventPins(eventId, token) {
      calls.push(['pins', eventId, token]);
      return [pin];
    },
    async loadPinCategories() {
      calls.push(['categories']);
      return [category];
    },
    ...overrides,
  };
  return { calls, useCases: createEventPinsUseCases(gateway) };
}

test('pin loading calls the gateway once with the exact event ID and token', async () => {
  const { calls, useCases } = setup();
  await useCases.loadEventPins(42, 'token-value');
  assert.deepEqual(calls, [['pins', 42, 'token-value']]);
});

test('pin loading preserves undefined and null tokens', async () => {
  const undefinedToken = setup();
  await undefinedToken.useCases.loadEventPins(42, undefined);
  assert.deepEqual(undefinedToken.calls, [['pins', 42, undefined]]);

  const nullToken = setup();
  await nullToken.useCases.loadEventPins(42, null);
  assert.deepEqual(nullToken.calls, [['pins', 42, null]]);
});

test('pin loading returns the raw array unchanged, including empty arrays', async () => {
  const pins = [pin];
  const { useCases } = setup({ loadEventPins: async () => pins });
  assert.equal(await useCases.loadEventPins(42), pins);

  const empty: EventPin[] = [];
  const emptyUseCases = setup({ loadEventPins: async () => empty }).useCases;
  assert.equal(await emptyUseCases.loadEventPins(42), empty);
});

test('category loading is independent and returns the raw array unchanged', async () => {
  const categories = [category];
  const { calls, useCases } = setup({ loadPinCategories: async () => categories });
  assert.equal(await useCases.loadPinCategories(), categories);
  assert.deepEqual(calls, []);

  const empty: PinCategory[] = [];
  const emptyUseCases = setup({ loadPinCategories: async () => empty }).useCases;
  assert.equal(await emptyUseCases.loadPinCategories(), empty);
});

test('pin and category operations do not map or combine their data', async () => {
  const pins = [pin];
  const categories = [category];
  const { useCases } = setup({
    loadEventPins: async () => pins,
    loadPinCategories: async () => categories,
  });
  assert.equal(await useCases.loadEventPins(42), pins);
  assert.equal(await useCases.loadPinCategories(), categories);
  assert.equal('iconUrl' in pins[0], false);
  assert.equal('title' in pins[0], false);
  assert.equal('emoji' in pins[0], false);
});

test('pin rejection propagates unchanged and does not load categories', async () => {
  const error = new Error('Pin request failed');
  const { calls, useCases } = setup({ loadEventPins: async () => { throw error; } });
  await assert.rejects(useCases.loadEventPins(42), (caught) => caught === error);
  assert.deepEqual(calls, []);
});

test('category rejection propagates unchanged and does not load pins', async () => {
  const error = new Error('Category request failed');
  const { calls, useCases } = setup({ loadPinCategories: async () => { throw error; } });
  await assert.rejects(useCases.loadPinCategories(), (caught) => caught === error);
  assert.deepEqual(calls, []);
});
