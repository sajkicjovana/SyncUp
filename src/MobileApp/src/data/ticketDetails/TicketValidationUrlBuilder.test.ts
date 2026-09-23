import assert from 'node:assert/strict';
import { test } from 'node:test';
import { API_URL } from '../../../config';
import { ticketValidationUrlBuilder } from './TicketValidationUrlBuilder';

test('builds the exact validation URL with the API prefix and unchanged segment order', () => {
  assert.equal(
    ticketValidationUrlBuilder.build(42, 'validation-token'),
    `${API_URL}/api/TicketValidation/validate/42/validation-token`,
  );
});

test('preserves raw interpolation without trimming, encoding, validation, or normalization', () => {
  const rawTicketId = ' ticket/id?x=1 ' as unknown as number;
  const rawToken = ' token/value?y=2 ';

  assert.equal(
    ticketValidationUrlBuilder.build(rawTicketId, rawToken),
    `${API_URL}/api/TicketValidation/validate/ ticket/id?x=1 / token/value?y=2 `,
  );
  assert.equal(
    ticketValidationUrlBuilder.build(0, ''),
    `${API_URL}/api/TicketValidation/validate/0/`,
  );
});
