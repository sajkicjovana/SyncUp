import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketValidationUrlBuilder } from './ports';
import { createBuildTicketValidationUrl } from './useCases';

test('forwards exact semantic values once and returns the builder result unchanged', () => {
  const calls: Array<{ ticketId: number; validationToken: string }> = [];
  const builder: TicketValidationUrlBuilder = {
    build(ticketId, validationToken) {
      calls.push({ ticketId, validationToken });
      return 'complete-validation-url';
    },
  };

  const buildTicketValidationUrl = createBuildTicketValidationUrl(builder);

  assert.equal(buildTicketValidationUrl(42, ' validation-token '), 'complete-validation-url');
  assert.deepEqual(calls, [{ ticketId: 42, validationToken: ' validation-token ' }]);
});

test('propagates the exact synchronous builder failure without retry', () => {
  const error = new Error('URL construction failed');
  let calls = 0;
  const builder: TicketValidationUrlBuilder = {
    build() {
      calls += 1;
      throw error;
    },
  };

  const buildTicketValidationUrl = createBuildTicketValidationUrl(builder);

  assert.throws(
    () => buildTicketValidationUrl(42, 'validation-token'),
    (caught) => caught === error,
  );
  assert.equal(calls, 1);
});
