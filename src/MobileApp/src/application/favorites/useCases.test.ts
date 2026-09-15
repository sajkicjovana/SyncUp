import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FavoriteEvent } from '../../domain/favorites';
import type { FavoritesGateway } from './ports';
import { createFavoritesUseCases } from './useCases';

const event: FavoriteEvent = {
  id: 3, title: 'Demo', location: 'City', imageUrl: 'image.png', startDate: '2020-01-01', attendingCount: 0,
};

function setup(token: string | null = 'stored-token') {
  const calls: unknown[][] = [];
  const gateway: FavoritesGateway = {
    async getFavorites(value) {
      calls.push(['get', value]);
      return { ok: true, events: [event] };
    },
    async changeFavorite(value, id, intent) {
      calls.push(['change', value, id, intent]);
      return { ok: true };
    },
  };
  const useCases = createFavoritesUseCases(gateway, async () => {
    calls.push(['token']);
    return token;
  });
  return { gateway, calls, useCases };
}

for (const token of [null, '']) {
  test(`missing token ${JSON.stringify(token)} prevents ID-load and mutation HTTP calls`, async () => {
    const { useCases, calls } = setup(token);
    assert.deepEqual(await useCases.loadFavoriteIds(), { kind: 'no-token' });
    assert.deepEqual(await useCases.toggleFavorite(3, []), { kind: 'no-token' });
    assert.deepEqual(calls, [['token'], ['token']]);
  });
}

test('screen token-read boundary prevents a guest request', async () => {
  const { useCases, calls } = setup(null);
  const token = await useCases.readToken();
  if (token) await useCases.loadFavoriteEvents(token);
  assert.equal(token, null);
  assert.deepEqual(calls, [['token']]);
});

test('token-read failure remains observable on every storage-reading operation', async () => {
  const { gateway, calls } = setup();
  const error = new Error('Storage failed');
  const useCases = createFavoritesUseCases(gateway, async () => { throw error; });
  for (const run of [useCases.readToken, useCases.loadFavoriteIds, () => useCases.toggleFavorite(3, [])]) {
    await assert.rejects(run, (caught) => caught === error);
  }
  assert.deepEqual(calls, []);
});

test('event loading preserves data, order, duplicates, child and ended entries', async () => {
  const { gateway, useCases, calls } = setup();
  const child = { ...event, id: 1, parentEventId: 9, endDate: '2000-01-01' };
  const events = [event, child, event];
  gateway.getFavorites = async (token) => {
    calls.push(['get', token]);
    return { ok: true, events };
  };
  const result = await useCases.loadFavoriteEvents('screen-token');
  assert.deepEqual(result, { ok: true, events });
  if (result.ok) assert.equal(result.events, events);
  assert.deepEqual(calls, [['get', 'screen-token']]);
});

test('ID loading projects IDs preserving duplicates and order', async () => {
  const { gateway, useCases, calls } = setup();
  gateway.getFavorites = async () => ({ ok: true, events: [event, { ...event, id: 1 }, event] });
  assert.deepEqual(await useCases.loadFavoriteIds(), { kind: 'loaded', ids: [3, 1, 3] });
  assert.deepEqual(calls, [['token']]);
});

test('empty favorite response is successful for events and IDs', async () => {
  const { gateway, useCases } = setup();
  gateway.getFavorites = async () => ({ ok: true, events: [] });
  assert.deepEqual(await useCases.loadFavoriteEvents('token'), { ok: true, events: [] });
  assert.deepEqual(await useCases.loadFavoriteIds(), { kind: 'loaded', ids: [] });
});

test('HTTP rejection preserves status for both load operations', async () => {
  const { gateway, useCases } = setup();
  gateway.getFavorites = async () => ({ ok: false, status: 403 });
  assert.deepEqual(await useCases.loadFavoriteEvents('token'), { ok: false, status: 403 });
  assert.deepEqual(await useCases.loadFavoriteIds(), { kind: 'rejected', status: 403 });
});

for (const error of [new Error('Network failed'), new SyntaxError('JSON failed')]) {
  test(`load failures preserve original error: ${error.message}`, async () => {
    const { gateway, useCases } = setup();
    gateway.getFavorites = async () => { throw error; };
    await assert.rejects(() => useCases.loadFavoriteEvents('token'), (caught) => caught === error);
    await assert.rejects(useCases.loadFavoriteIds, (caught) => caught === error);
  });
}

for (const [ids, intent] of [[[], 'add'], [[3], 'remove']] as const) {
  test(`${intent} sends expected ID/token and performs no refresh`, async () => {
    const { useCases, calls } = setup();
    assert.deepEqual(await useCases.toggleFavorite(3, [...ids]), { kind: 'changed' });
    assert.deepEqual(calls, [['token'], ['change', 'stored-token', 3, intent]]);
  });
}

test('rejected mutation preserves response text and does not refresh', async () => {
  const { gateway, useCases, calls } = setup();
  gateway.changeFavorite = async () => ({ ok: false, text: 'Server rejection' });
  assert.deepEqual(await useCases.toggleFavorite(3, []), { kind: 'rejected', text: 'Server rejection' });
  assert.deepEqual(calls, [['token']]);
});

test('mutation errors preserve the original error', async () => {
  const { gateway, useCases } = setup();
  const error = new Error('Response text failed');
  gateway.changeFavorite = async () => { throw error; };
  await assert.rejects(() => useCases.toggleFavorite(3, []), (caught) => caught === error);
});

test('caller-owned refresh performs a second token read after mutation', async () => {
  const { useCases, calls } = setup();
  const result = await useCases.toggleFavorite(3, []);
  if (result.kind === 'changed') await useCases.loadFavoriteIds();
  assert.deepEqual(calls, [
    ['token'], ['change', 'stored-token', 3, 'add'], ['token'], ['get', 'stored-token'],
  ]);
});
