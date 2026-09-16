import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventLocation } from '../../domain/eventLocation';
import type { EventLocationGateway } from './ports';
import { createGeocodeLocation } from './useCases';

const coordinates: EventLocation = { latitude: 44.8125, longitude: 20.4612 };

function setup(geocode: EventLocationGateway['geocodeLocation'] = async () => coordinates) {
  const calls: string[] = [];
  const gateway: EventLocationGateway = {
    async geocodeLocation(location) {
      calls.push(location);
      return geocode(location);
    },
  };
  return { calls, geocodeLocation: createGeocodeLocation(gateway) };
}

test('geocoding forwards the exact location once and returns the same coordinates', async () => {
  const result = await setup().geocodeLocation(' City + venue & hall ');

  assert.deepEqual(result, coordinates);
  assert.deepEqual(setup().calls, []);

  const configured = setup();
  const configuredResult = await configured.geocodeLocation(' City + venue & hall ');
  assert.equal(configuredResult, coordinates);
  assert.deepEqual(configured.calls, [' City + venue & hall ']);
});

test('geocoding returns a null result unchanged', async () => {
  const configured = setup(async () => null);

  const result = await configured.geocodeLocation('Unknown location');

  assert.equal(result, null);
  assert.deepEqual(configured.calls, ['Unknown location']);
});

test('geocoding does not transform or mutate the gateway result', async () => {
  const resultObject = Object.freeze({ ...coordinates });
  const configured = setup(async () => resultObject);

  const result = await configured.geocodeLocation('City');

  assert.equal(result, resultObject);
  assert.deepEqual(result, coordinates);
});

test('geocoding propagates gateway rejection unchanged', async () => {
  const error = new Error('Network failure');
  const configured = setup(async () => { throw error; });

  await assert.rejects(configured.geocodeLocation('City'), (caught) => caught === error);
});
