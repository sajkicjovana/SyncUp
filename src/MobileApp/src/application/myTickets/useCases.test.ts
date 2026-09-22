import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MyTicketRow, MyTicketsGateway } from './ports';
import { createLoadMyTickets, MyTicketsTokenReadError } from './useCases';

const row = (overrides: Partial<MyTicketRow> = {}): MyTicketRow => ({
  purchasedAt: '2026-01-01T10:00:00Z',
  ticketType: 'VIP',
  eventName: 'Conference',
  price: 100,
  eventId: 5,
  userTicketId: 10,
  validationToken: 'token-10',
  ...overrides,
});

test('reads token once, forwards it exactly, and returns an empty loaded result', async () => {
  let tokenReads = 0;
  const tokens: string[] = [];
  const gateway: MyTicketsGateway = {
    async loadMyTickets(token) { tokens.push(token); return { ok: true, tickets: [] }; },
  };

  const result = await createLoadMyTickets(gateway, async () => { tokenReads++; return 'held-token'; })();

  assert.equal(tokenReads, 1);
  assert.deepEqual(tokens, ['held-token']);
  assert.deepEqual(result, { status: 'loaded', tickets: [] });
});

test('missing and empty tokens skip the gateway without logging policy in Application', async () => {
  for (const token of [null, '']) {
    let tokenReads = 0;
    let gatewayCalls = 0;
    const gateway: MyTicketsGateway = {
      async loadMyTickets() { gatewayCalls++; return { ok: true, tickets: [] }; },
    };

    assert.deepEqual(
      await createLoadMyTickets(gateway, async () => { tokenReads++; return token; })(),
      { status: 'missing-token' },
    );
    assert.equal(tokenReads, 1);
    assert.equal(gatewayCalls, 0);
  }
});

test('keeps a gateway non-OK result distinct', async () => {
  const gateway: MyTicketsGateway = {
    async loadMyTickets() { return { ok: false }; },
  };
  assert.deepEqual(await createLoadMyTickets(gateway, async () => 'held-token')(), { status: 'non-ok' });
});

test('groups by display key, merges different event IDs, and preserves first-row metadata and duplicates', async () => {
  const duplicate = row({ purchasedAt: '2026-03-01T10:00:00Z', eventId: 8, userTicketId: 11, validationToken: 'token-11', price: 999 });
  const rows = [row(), duplicate, duplicate];
  const snapshot = rows.map(ticket => ({ ...ticket }));
  const gateway: MyTicketsGateway = {
    async loadMyTickets() { return { ok: true, tickets: rows }; },
  };

  const result = await createLoadMyTickets(gateway, async () => 'held-token')();

  assert.deepEqual(result, { status: 'loaded', tickets: [{
    ticketType: 'VIP',
    eventName: 'Conference',
    price: 100,
    quantity: 3,
    eventId: 5,
    purchasedAt: ['2026-01-01T10:00:00Z', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z'],
    ticketIds: [10, 11, 11],
    validationTokens: ['token-10', 'token-11', 'token-11'],
  }] });
  assert.deepEqual(rows, snapshot);
});

test('keeps different event names or ticket types in separate groups', async () => {
  const rows = [
    row({ eventName: 'A', ticketType: 'VIP', purchasedAt: '2026-03-01T00:00:00Z' }),
    row({ eventName: 'B', ticketType: 'VIP', userTicketId: 11, purchasedAt: '2026-02-01T00:00:00Z' }),
    row({ eventName: 'A', ticketType: 'Regular', userTicketId: 12, purchasedAt: '2026-01-01T00:00:00Z' }),
  ];
  const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };

  const result = await createLoadMyTickets(gateway, async () => 'held-token')();
  assert.equal(result.status, 'loaded');
  if (result.status !== 'loaded') return;
  assert.deepEqual(result.tickets.map(group => [group.eventName, group.ticketType]), [
    ['A', 'VIP'], ['B', 'VIP'], ['A', 'Regular'],
  ]);
});

test('preserves delimiter-induced key collisions with first-row metadata', async () => {
  const rows = [
    row({ eventName: 'A_B', ticketType: 'C', eventId: 1, price: 10 }),
    row({ eventName: 'A', ticketType: 'B_C', eventId: 2, price: 20, userTicketId: 20 }),
  ];
  const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };

  const result = await createLoadMyTickets(gateway, async () => 'held-token')();
  assert.equal(result.status, 'loaded');
  if (result.status !== 'loaded') return;
  assert.equal(result.tickets.length, 1);
  assert.deepEqual({
    eventName: result.tickets[0].eventName,
    ticketType: result.tickets[0].ticketType,
    eventId: result.tickets[0].eventId,
    price: result.tickets[0].price,
    quantity: result.tickets[0].quantity,
  }, { eventName: 'A_B', ticketType: 'C', eventId: 1, price: 10, quantity: 2 });
});

test('uses zero only for a nullish first-row event ID', async () => {
  const rows = [row({ eventId: null }), row({ eventId: 7, userTicketId: 11 })];
  const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };
  const result = await createLoadMyTickets(gateway, async () => 'held-token')();
  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') assert.equal(result.tickets[0].eventId, 0);
});

test('sorts by each group last appended date rather than its maximum date', async () => {
  const rows = [
    row({ eventName: 'First', purchasedAt: '2030-01-01T00:00:00Z' }),
    row({ eventName: 'Second', userTicketId: 20, purchasedAt: '2028-01-01T00:00:00Z' }),
    row({ eventName: 'First', userTicketId: 11, purchasedAt: '2020-01-01T00:00:00Z' }),
  ];
  const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };
  const result = await createLoadMyTickets(gateway, async () => 'held-token')();
  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') assert.deepEqual(result.tickets.map(group => group.eventName), ['Second', 'First']);
});

test('invalid and tied dates retain first-key encounter order', async () => {
  for (const dates of [['invalid', '2026-01-01T00:00:00Z'], ['2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z']]) {
    const rows = [
      row({ eventName: 'First', purchasedAt: dates[0] }),
      row({ eventName: 'Second', userTicketId: 20, purchasedAt: dates[1] }),
    ];
    const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };
    const result = await createLoadMyTickets(gateway, async () => 'held-token')();
    assert.equal(result.status, 'loaded');
    if (result.status === 'loaded') assert.deepEqual(result.tickets.map(group => group.eventName), ['First', 'Second']);
  }
});

test('validation-token projection uses strict first raw ID match and empty fallback', async () => {
  const rows = [
    row({ userTicketId: 7, validationToken: 'first' }),
    row({ userTicketId: 7, validationToken: 'second' }),
    row({ userTicketId: '7', validationToken: 'string-id' }),
    row({ userTicketId: 8, validationToken: undefined }),
  ];
  const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };
  const result = await createLoadMyTickets(gateway, async () => 'held-token')();
  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(result.tickets[0].ticketIds, [7, 7, '7', 8]);
    assert.deepEqual(result.tickets[0].validationTokens, ['first', 'first', 'string-id', '']);
  }
});

test('missing IDs preserve first-match behavior', async () => {
  const rows = [
    row({ userTicketId: undefined, validationToken: 'first-missing' }),
    row({ userTicketId: undefined, validationToken: 'second-missing' }),
  ];
  const gateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: rows }; } };
  const result = await createLoadMyTickets(gateway, async () => 'held-token')();
  assert.equal(result.status, 'loaded');
  if (result.status === 'loaded') {
    assert.deepEqual(result.tickets[0].ticketIds, [undefined, undefined]);
    assert.deepEqual(result.tickets[0].validationTokens, ['first-missing', 'first-missing']);
  }
});

test('gateway and projection failures propagate unchanged', async () => {
  const gatewayError = new Error('gateway failed');
  const failingGateway: MyTicketsGateway = { async loadMyTickets() { throw gatewayError; } };
  await assert.rejects(createLoadMyTickets(failingGateway, async () => 'held-token')(), error => error === gatewayError);

  const projectionError = new Error('projection failed');
  const brokenRow = row();
  Object.defineProperty(brokenRow, 'eventName', { get() { throw projectionError; } });
  const projectionGateway: MyTicketsGateway = { async loadMyTickets() { return { ok: true, tickets: [brokenRow] }; } };
  await assert.rejects(createLoadMyTickets(projectionGateway, async () => 'held-token')(), error => error === projectionError);
});

test('token-reader rejection is marked separately and never calls the gateway', async () => {
  const tokenError = new Error('storage failed');
  let gatewayCalls = 0;
  const gateway: MyTicketsGateway = {
    async loadMyTickets() { gatewayCalls++; return { ok: true, tickets: [] }; },
  };

  await assert.rejects(
    createLoadMyTickets(gateway, async () => { throw tokenError; })(),
    error => error instanceof MyTicketsTokenReadError && error.originalError === tokenError,
  );
  assert.equal(gatewayCalls, 0);
});
