import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSessionUnexpired, validateCredentials } from './auth';

test('accepts the current minimal email rule without trimming credentials', () => {
  assert.equal(validateCredentials({ email: '@', password: 'Abcdef1!' }), null);
  assert.equal(validateCredentials({ email: ' @ ', password: 'Abcdef1!' }), null);
});

test('missing fields take precedence over email and password format', () => {
  for (const credentials of [
    { email: '', password: '' },
    { email: '', password: 'weak' },
    { email: 'invalid', password: '' },
  ]) {
    assert.equal(validateCredentials(credentials), 'missingFields');
  }
});

test('invalid email takes precedence over invalid password', () => {
  assert.equal(validateCredentials({ email: 'invalid', password: 'weak' }), 'invalidEmail');
  assert.equal(validateCredentials({ email: '   ', password: 'Abcdef1!' }), 'invalidEmail');
});

for (const [rule, password] of [
  ['eight characters', 'Abcde1!'],
  ['uppercase', 'abcdef1!'],
  ['lowercase', 'ABCDEF1!'],
  ['number', 'Abcdefg!'],
  ['special character', 'Abcdefg1'],
  ['only the existing special-character set', 'Abcdef1/'],
]) {
  test(`password requires ${rule}`, () => {
    assert.equal(validateCredentials({ email: 'demo@example.test', password }), 'invalidPassword');
  });
}

test('accepts every special character supported by the baseline', () => {
  for (const special of '!@#$%^&*(),.?":{}|<>_-+=') {
    assert.equal(validateCredentials({ email: '@', password: `Abcdef1${special}` }), null);
  }
});

test('expiry must be truthy and strictly later than the current second', () => {
  assert.equal(isSessionUnexpired(101, 100), true);
  for (const expiry of [100, 99, 0, null, undefined, '', 'invalid']) {
    assert.equal(isSessionUnexpired(expiry, 100), false);
  }
  // Do not silently tighten the baseline's coercive comparison during extraction.
  assert.equal(isSessionUnexpired('101', 100), true);
  assert.equal(isSessionUnexpired('100', 100), false);
});
