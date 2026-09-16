import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventResourcesGateway } from './ports';
import { createLoadEventResources } from './useCases';

const resources = [{ id: 1, name: 'Water' }];

function setup(loadEventResources: EventResourcesGateway['loadEventResources'] = async () => resources) {
  const calls: unknown[][] = [];
  const gateway: EventResourcesGateway = {
    async loadEventResources(eventId, token) {
      calls.push([eventId, token]);
      return loadEventResources(eventId, token);
    },
  };
  return { calls, loadEventResources: createLoadEventResources(gateway) };
}

test('resource loading forwards the exact event ID and token once', async () => {
  const configured = setup();

  await configured.loadEventResources('42', 'token-value');

  assert.deepEqual(configured.calls, [['42', 'token-value']]);
});

test('each use-case invocation makes an independent gateway call', async () => {
  const configured = setup();

  await configured.loadEventResources('42', 'token-value');
  await configured.loadEventResources('42', 'token-value');

  assert.deepEqual(configured.calls, [
    ['42', 'token-value'],
    ['42', 'token-value'],
  ]);
});

test('resource loading returns the exact array unchanged, including empty arrays', async () => {
  const result = await setup().loadEventResources('42', 'token-value');
  assert.equal(result, resources);

  const empty: unknown[] = [];
  const emptyResult = await setup(async () => empty).loadEventResources('42', 'token-value');
  assert.equal(emptyResult, empty);
});

test('resource loading does not calculate availability or apply guest policy', async () => {
  const configured = setup(async () => resources);

  const result = await configured.loadEventResources('42', 'token-value');

  assert.equal(result, resources);
  assert.equal('hasResources' in (result as object), false);
});

test('resource loading propagates gateway rejection unchanged', async () => {
  const error = new Error('Resource request failed');
  const configured = setup(async () => { throw error; });

  await assert.rejects(configured.loadEventResources('42', 'token-value'), (caught) => caught === error);
});
