import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventAgendaResponse } from '../../domain/eventAgenda';
import type { EventAgendaGateway } from './ports';
import { createLoadEventAgenda } from './useCases';

const agenda: EventAgendaResponse = {
  eventsAndSubevents: [{
    eventId: 2,
    title: 'Subevent',
    location: 'City',
    startDate: '2026-09-16T10:00:00.000Z',
    endDate: '2026-09-16T11:00:00.000Z',
    imageUrl: 'images/subevent.png',
    parentEventId: 1,
    description: 'Description',
  }],
  activities: [{
    activityId: 3,
    eventId: 2,
    title: 'Activity',
    startDate: '2026-09-16T11:00:00.000Z',
    endDate: '2026-09-16T12:00:00.000Z',
    description: 'Activity description',
    category: 'Other',
  }],
};

function setup(loadAgenda: EventAgendaGateway['loadAgenda'] = async () => agenda) {
  const calls: unknown[][] = [];
  const gateway: EventAgendaGateway = {
    async loadAgenda(eventId, token) {
      calls.push([eventId, token]);
      return loadAgenda(eventId, token);
    },
  };
  return { calls, loadEventAgenda: createLoadEventAgenda(gateway) };
}

test('agenda loading calls the gateway once with the exact event ID and token', async () => {
  const { calls, loadEventAgenda } = setup();
  await loadEventAgenda('42', 'token-value');
  assert.deepEqual(calls, [['42', 'token-value']]);
});

test('agenda loading forwards an undefined token unchanged', async () => {
  const { calls, loadEventAgenda } = setup();
  await loadEventAgenda(42, undefined);
  assert.deepEqual(calls, [[42, undefined]]);
});

test('agenda loading forwards a missing token as null unchanged', async () => {
  const { calls, loadEventAgenda } = setup();
  await loadEventAgenda(42, null);
  assert.deepEqual(calls, [[42, null]]);
});

test('agenda loading returns the exact gateway response unchanged', async () => {
  const { loadEventAgenda } = setup();
  const result = await loadEventAgenda(42, 'token-value');
  assert.equal(result, agenda);
});

test('empty agenda collections are valid and unchanged', async () => {
  const empty: EventAgendaResponse = { eventsAndSubevents: [], activities: [] };
  const { loadEventAgenda } = setup(async () => empty);
  assert.equal(await loadEventAgenda(42), empty);
});

test('agenda loading does not sort, merge, filter, or mutate the response', async () => {
  const input: EventAgendaResponse = {
    eventsAndSubevents: [agenda.eventsAndSubevents[0], { ...agenda.eventsAndSubevents[0], eventId: 1 }],
    activities: [agenda.activities[0], { ...agenda.activities[0], activityId: 1 }],
  };
  const { loadEventAgenda } = setup(async () => input);
  const result = await loadEventAgenda(42);
  assert.equal(result, input);
  assert.deepEqual(result.eventsAndSubevents.map((event) => event.eventId), [2, 1]);
  assert.deepEqual(result.activities.map((activity) => activity.activityId), [3, 1]);
});

test('agenda loading propagates gateway rejection unchanged', async () => {
  const error = new Error('Agenda request failed');
  const { loadEventAgenda } = setup(async () => { throw error; });
  await assert.rejects(loadEventAgenda(42), (caught) => caught === error);
});
