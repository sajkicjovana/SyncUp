import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../../config';
import { httpPersonalInfoGateway } from './HttpPersonalInfoGateway';

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
const originalFetch = globalThis.fetch;
const originalFormData = globalThis.FormData;
const originalGetItem = AsyncStorage.getItem;

class TestFormData {
  readonly parts: Array<{ name: string; value: unknown }> = [];
  append(name: string, value: unknown) { this.parts.push({ name, value }); }
}

function mockFetch(response: Partial<Response>) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response as Response;
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => {
  AsyncStorage.getItem = async () => 'sr';
  globalThis.FormData = TestFormData as unknown as typeof FormData;
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.FormData = originalFormData;
  AsyncStorage.getItem = originalGetItem;
});

const profile = {
  firstName: '  Ana  ',
  lastName: ' Anic ',
  email: ' ana@example.test ',
  phoneNumber: ' +381601234567 ',
  profilePicture: 'http://example.test/avatar.jpg',
};

test('update preserves exact request and ignores a successful body', async () => {
  let jsonReads = 0;
  const calls = mockFetch({
    ok: true,
    json: async () => { jsonReads++; throw new Error('must not parse'); },
  });
  assert.deepEqual(await httpPersonalInfoGateway.updateProfile('token', profile), { ok: true });
  assert.equal(jsonReads, 0);
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/MobileUser/profileUpdate`,
    init: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
        'Accept-Language': 'sr',
      },
      body: JSON.stringify(profile),
    },
  }]);
});

test('update rejection preserves present or absent backend message', async () => {
  for (const [json, backendMessage] of [
    [{ message: 'backend message' }, 'backend message'],
    [{ ignored: true }, undefined],
  ] as const) {
    mockFetch({ ok: false, json: async () => json });
    assert.deepEqual(await httpPersonalInfoGateway.updateProfile('token', profile), {
      ok: false,
      backendMessage,
    });
  }
});

test('update invalid rejection JSON and transport errors propagate', async () => {
  const jsonError = new SyntaxError('invalid JSON');
  mockFetch({ ok: false, json: async () => { throw jsonError; } });
  await assert.rejects(
    httpPersonalInfoGateway.updateProfile('token', profile),
    caught => caught === jsonError,
  );
  const networkError = new Error('network');
  globalThis.fetch = (async () => { throw networkError; }) as typeof fetch;
  await assert.rejects(
    httpPersonalInfoGateway.updateProfile('token', profile),
    caught => caught === networkError,
  );
});

test('upload preserves exact direct multipart request without language/content-type', async () => {
  let languageReads = 0;
  AsyncStorage.getItem = async () => { languageReads++; return 'en'; };
  const calls = mockFetch({
    ok: true,
    json: async () => ({ imageUrl: '/images/profile.jpg' }),
  });
  assert.deepEqual(
    await httpPersonalInfoGateway.uploadProfileImage('token', 'file:///selected.jpg'),
    { ok: true, imageUrl: `${API_URL}/images/profile.jpg` },
  );
  assert.equal(languageReads, 0);
  assert.equal(calls[0].input, `${API_URL}/api/MobileUser/profile-image`);
  assert.equal(calls[0].init?.method, 'PUT');
  assert.deepEqual(calls[0].init?.headers, { Authorization: 'Bearer token' });
  assert.equal(Object.hasOwn(calls[0].init?.headers ?? {}, 'Content-Type'), false);
  assert.equal(Object.hasOwn(calls[0].init?.headers ?? {}, 'Accept-Language'), false);
  assert.ok(calls[0].init?.body instanceof TestFormData);
  assert.deepEqual((calls[0].init?.body as unknown as TestFormData).parts, [{
    name: 'Image',
    value: {
      uri: 'file:///selected.jpg',
      name: 'profile.jpg',
      type: 'image/jpeg',
    },
  }]);
});

test('upload preserves image URL normalization', async () => {
  for (const [imageUrl, expected] of [
    ['http://cdn.test/a.jpg', 'http://cdn.test/a.jpg'],
    ['https://cdn.test/a.jpg', 'https://cdn.test/a.jpg'],
    ['images/a.jpg', `${API_URL}/images/a.jpg`],
    ['', null],
    [null, null],
  ] as const) {
    mockFetch({ ok: true, json: async () => ({ imageUrl }) });
    assert.deepEqual(
      await httpPersonalInfoGateway.uploadProfileImage('token', 'file:///image.jpg'),
      { ok: true, imageUrl: expected },
    );
  }
});

test('upload non-OK preserves response text and skips JSON', async () => {
  for (const responseText of ['rejected', '']) {
    let jsonReads = 0;
    mockFetch({
      ok: false,
      text: async () => responseText,
      json: async () => { jsonReads++; throw new Error('must not parse'); },
    });
    assert.deepEqual(
      await httpPersonalInfoGateway.uploadProfileImage('token', 'file:///image.jpg'),
      { ok: false, responseText },
    );
    assert.equal(jsonReads, 0);
  }
});

test('upload JSON, response-text, and transport errors propagate', async () => {
  const jsonError = new SyntaxError('invalid upload JSON');
  mockFetch({ ok: true, json: async () => { throw jsonError; } });
  await assert.rejects(
    httpPersonalInfoGateway.uploadProfileImage('token', 'file:///image.jpg'),
    caught => caught === jsonError,
  );
  const textError = new Error('text failed');
  mockFetch({ ok: false, text: async () => { throw textError; } });
  await assert.rejects(
    httpPersonalInfoGateway.uploadProfileImage('token', 'file:///image.jpg'),
    caught => caught === textError,
  );
  const networkError = new Error('network');
  globalThis.fetch = (async () => { throw networkError; }) as typeof fetch;
  await assert.rejects(
    httpPersonalInfoGateway.uploadProfileImage('token', 'file:///image.jpg'),
    caught => caught === networkError,
  );
});

test('delete preserves exact request and ignores a successful body', async () => {
  let bodyReads = 0;
  const calls = mockFetch({
    ok: true,
    text: async () => { bodyReads++; return 'unused'; },
    json: async () => { bodyReads++; return {}; },
  });
  assert.deepEqual(await httpPersonalInfoGateway.deleteProfileImage('token'), { ok: true });
  assert.equal(bodyReads, 0);
  assert.deepEqual(calls, [{
    input: `${API_URL}/api/MobileUser/delete-profile-picture`,
    init: {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token',
        'Accept-Language': 'sr',
      },
    },
  }]);
  assert.equal((calls[0].init as RequestInit | undefined)?.body, undefined);
});

test('delete non-OK preserves response text including empty text', async () => {
  for (const responseText of ['rejected', '']) {
    mockFetch({ ok: false, text: async () => responseText });
    assert.deepEqual(await httpPersonalInfoGateway.deleteProfileImage('token'), {
      ok: false,
      responseText,
    });
  }
});

test('delete response-text and transport errors propagate', async () => {
  const textError = new Error('text failed');
  mockFetch({ ok: false, text: async () => { throw textError; } });
  await assert.rejects(
    httpPersonalInfoGateway.deleteProfileImage('token'),
    caught => caught === textError,
  );
  const networkError = new Error('network');
  globalThis.fetch = (async () => { throw networkError; }) as typeof fetch;
  await assert.rejects(
    httpPersonalInfoGateway.deleteProfileImage('token'),
    caught => caught === networkError,
  );
});
