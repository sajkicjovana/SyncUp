import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Credentials } from '../../domain/auth';
import type { AuthGateway, ChangePasswordGateway, LoginResult, RegisterUserGateway, RegistrationInput, SessionStore } from './ports';
import { createChangePassword, createReadAuthToken, createRegisterUser, createRequestPasswordRecovery, createRestoreSession, createSignIn, discardSession } from './useCases';

const credentials: Credentials = { email: 'demo@example.test', password: 'Abcdef1!' };
const passwords = { currentPassword: 'Current1!', newPassword: 'NewPass2!' };
const registration: RegistrationInput = {
  firstName: ' Demo ',
  lastName: ' User ',
  email: ' demo@example.test ',
  password: ' Abcdef1! ',
  confirmPassword: ' Abcdef1! ',
};

function setup(initialToken: string | null = null) {
  let token = initialToken;
  const calls: string[] = [];
  const store: SessionStore = {
    async getToken() {
      calls.push('read');
      return token;
    },
    async saveToken(value) {
      calls.push('save');
      token = value;
    },
    async removeToken() {
      calls.push('remove');
      token = null;
    },
  };
  const gateway: AuthGateway = {
    async login(received) {
      calls.push('login');
      assert.deepEqual(received, credentials);
      return { ok: true, token: 'issued-token' };
    },
    async isMobileUser(value) {
      calls.push('eligibility');
      assert.equal(value, 'issued-token');
      assert.equal(token, initialToken, 'eligibility must run before session persistence');
      return true;
    },
    async requestPasswordReset(email) {
      calls.push(`recovery:${email}`);
      return { ok: true };
    },
  };
  return { calls, store, gateway, currentToken: () => token };
}

test('discarding a session removes the token exactly once', async () => {
  const fake = setup('stored-token');

  await discardSession(fake.store);

  assert.deepEqual(fake.calls, ['remove']);
  assert.equal(fake.currentToken(), null);
});

test('session discard propagates the original removal error without retrying', async () => {
  const fake = setup('stored-token');
  const error = new Error('Remove failed');
  let removeCalls = 0;
  fake.store.removeToken = async () => {
    removeCalls += 1;
    throw error;
  };

  await assert.rejects(discardSession(fake.store), (caught) => caught === error);
  assert.equal(removeCalls, 1);
});

test('raw auth token read returns the exact non-empty token after one reader call', async () => {
  let reads = 0;
  const readAuthToken = createReadAuthToken(async () => {
    reads += 1;
    return 'stored-token';
  });

  assert.equal(await readAuthToken(), 'stored-token');
  assert.equal(reads, 1);
});

for (const token of [null, ''] as const) {
  test(`raw auth token read preserves ${token === null ? 'null' : 'empty string'} unchanged`, async () => {
    let reads = 0;
    const readAuthToken = createReadAuthToken(async () => {
      reads += 1;
      return token;
    });

    assert.equal(await readAuthToken(), token);
    assert.equal(reads, 1);
  });
}

test('raw auth token read propagates the exact reader failure without retry or other Auth work', async () => {
  const error = new Error('Read failed');
  let reads = 0;
  const readAuthToken = createReadAuthToken(async () => {
    reads += 1;
    throw error;
  });

  await assert.rejects(readAuthToken(), (caught) => caught === error);
  assert.equal(reads, 1);
});

test('invalid credentials never call the gateway or session store', async () => {
  const fake = setup();
  const signIn = createSignIn(fake.gateway, fake.store);
  for (const [input, reason] of [
    [{ email: '', password: '' }, 'missingFields'],
    [{ email: 'invalid', password: 'weak' }, 'invalidEmail'],
    [{ email: '@', password: 'weak' }, 'invalidPassword'],
  ] as const) {
    assert.deepEqual(await signIn(input), { status: 'invalid-credentials', reason });
  }
  assert.deepEqual(fake.calls, []);
});

for (const [label, loginResult, expected] of [
  ['rejected login', { ok: false, message: 'Rejected' }, { status: 'login-rejected', message: 'Rejected' }],
  ['missing token', { ok: true }, { status: 'missing-token' }],
  ['empty token', { ok: true, token: '' }, { status: 'missing-token' }],
] as const) {
  test(`${label} does not check eligibility or save a session`, async () => {
    const fake = setup('existing-token');
    fake.gateway.login = async (): Promise<LoginResult> => {
      fake.calls.push('login');
      return loginResult;
    };
    assert.deepEqual(await createSignIn(fake.gateway, fake.store)(credentials), expected);
    assert.deepEqual(fake.calls, ['login']);
    assert.equal(fake.currentToken(), 'existing-token');
  });
}

test('rejected MobileUser eligibility does not save a session', async () => {
  const fake = setup();
  fake.gateway.isMobileUser = async () => {
    fake.calls.push('eligibility');
    return false;
  };
  assert.deepEqual(await createSignIn(fake.gateway, fake.store)(credentials), { status: 'not-mobile-user' });
  assert.deepEqual(fake.calls, ['login', 'eligibility']);
  assert.equal(fake.currentToken(), null);
});

test('successful sign-in awaits eligibility before storing the issued token', async () => {
  const fake = setup();
  let release!: (eligible: boolean) => void;
  fake.gateway.isMobileUser = () => {
    fake.calls.push('eligibility');
    return new Promise<boolean>((resolve) => { release = resolve; });
  };
  const pending = createSignIn(fake.gateway, fake.store)(credentials);
  await Promise.resolve();
  assert.deepEqual(fake.calls, ['login', 'eligibility']);
  assert.equal(fake.currentToken(), null);
  release(true);
  assert.deepEqual(await pending, { status: 'signed-in' });
  assert.deepEqual(fake.calls, ['login', 'eligibility', 'save']);
  assert.equal(fake.currentToken(), 'issued-token');
});

test('sign-in passes credentials through unchanged', async () => {
  const fake = setup();
  const untrimmed = { email: ' demo@example.test ', password: ' Abcdef1! ' };
  fake.gateway.login = async (received) => {
    assert.deepEqual(received, untrimmed);
    return { ok: true, token: 'issued-token' };
  };
  assert.deepEqual(await createSignIn(fake.gateway, fake.store)(untrimmed), { status: 'signed-in' });
});

for (const stage of ['login', 'eligibility', 'save'] as const) {
  test(`${stage} failure produces a failure outcome without saving a session`, async () => {
    const fake = setup();
    const fail = async () => { throw new Error(`${stage} failed`); };
    if (stage === 'login') fake.gateway.login = fail;
    else if (stage === 'eligibility') fake.gateway.isMobileUser = fail;
    else fake.store.saveToken = fail;
    assert.deepEqual(await createSignIn(fake.gateway, fake.store)(credentials), {
      status: 'failure', message: `${stage} failed`,
    });
    assert.equal(fake.currentToken(), null);
  });
}

test('restoration with no stored token skips decoding and cleanup', async () => {
  const fake = setup();
  const restore = createRestoreSession(fake.store, () => assert.fail('must not decode'), () => 100);
  assert.deepEqual(await restore(), { status: 'unauthenticated' });
  assert.deepEqual(fake.calls, ['read']);
});

for (const [label, expiry, valid] of [
  ['valid', 101, true],
  ['expired', 99, false],
  ['expiry exactly at current time', 100, false],
  ['missing expiry', undefined, false],
  ['invalid expiry', 'not-a-time', false],
  ['numeric-string expiry', '101', true],
] as const) {
  test(`restores or removes a token with ${label}`, async () => {
    const fake = setup('stored-token');
    const restore = createRestoreSession(fake.store, (token) => {
      fake.calls.push('decode');
      assert.equal(token, 'stored-token');
      return expiry;
    }, () => 100);
    assert.deepEqual(await restore(), valid
      ? { status: 'authenticated', token: 'stored-token' }
      : { status: 'unauthenticated' });
    assert.equal(fake.currentToken(), valid ? 'stored-token' : null);
    assert.deepEqual(fake.calls, valid ? ['read', 'decode'] : ['read', 'decode', 'remove']);
  });
}

test('malformed token decoding failure removes the token', async () => {
  const fake = setup('malformed-token');
  const restore = createRestoreSession(fake.store, () => {
    throw new SyntaxError('Malformed payload');
  }, () => 100);
  assert.deepEqual(await restore(), { status: 'unauthenticated' });
  assert.equal(fake.currentToken(), null);
  assert.deepEqual(fake.calls, ['read', 'remove']);
});

test('session read failure still attempts cleanup', async () => {
  const fake = setup('stored-token');
  fake.store.getToken = async () => { throw new Error('Read failed'); };
  assert.deepEqual(await createRestoreSession(fake.store, () => 101, () => 100)(), {
    status: 'unauthenticated',
  });
  assert.deepEqual(fake.calls, ['remove']);
  assert.equal(fake.currentToken(), null);
});

test('cleanup failure is retried and remains observable if it fails again', async () => {
  const fake = setup('stored-token');
  fake.store.removeToken = async () => {
    fake.calls.push('remove');
    throw new Error('Remove failed');
  };
  await assert.rejects(createRestoreSession(fake.store, () => 99, () => 100), /Remove failed/);
  assert.deepEqual(fake.calls, ['read', 'remove', 'remove']);
});

test('password recovery forwards the exact email and preserves success', async () => {
  const fake = setup();
  const recover = createRequestPasswordRecovery(fake.gateway);
  assert.deepEqual(await recover(' person@example.test '), { ok: true });
  assert.deepEqual(fake.calls, ['recovery: person@example.test ']);
});

test('password recovery preserves a backend rejection message', async () => {
  const fake = setup();
  fake.gateway.requestPasswordReset = async () => ({ ok: false, message: 'Rejected' });
  assert.deepEqual(await createRequestPasswordRecovery(fake.gateway)('person@example.test'), { ok: false, message: 'Rejected' });
});

test('password recovery preserves a backend rejection without a message', async () => {
  const fake = setup();
  fake.gateway.requestPasswordReset = async () => ({ ok: false });
  assert.deepEqual(await createRequestPasswordRecovery(fake.gateway)('person@example.test'), { ok: false });
});

test('password recovery propagates the original gateway error', async () => {
  const fake = setup();
  const error = new SyntaxError('Invalid JSON');
  fake.gateway.requestPasswordReset = async () => { throw error; };
  await assert.rejects(createRequestPasswordRecovery(fake.gateway)('person@example.test'), (caught) => caught === error);
});

test('registration forwards the exact semantic input once and preserves success', async () => {
  const calls: RegistrationInput[] = [];
  const gateway: RegisterUserGateway = {
    async registerUser(input) {
      calls.push(input);
      return { ok: true };
    },
  };

  assert.deepEqual(await createRegisterUser(gateway)(registration), { status: 'registered' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0], registration);
});

test('registration preserves a backend rejection message', async () => {
  const gateway: RegisterUserGateway = {
    async registerUser() {
      return { ok: false, message: 'Rejected' };
    },
  };

  assert.deepEqual(await createRegisterUser(gateway)(registration), {
    status: 'rejected',
    message: 'Rejected',
  });
});

test('registration preserves rejection messages without a usable value', async () => {
  for (const message of ['', undefined] as const) {
    const gateway: RegisterUserGateway = {
      async registerUser() {
        return { ok: false, message };
      },
    };

    assert.deepEqual(await createRegisterUser(gateway)(registration), {
      status: 'rejected',
      message,
    });
  }
});

test('registration propagates the original gateway failure without retrying', async () => {
  const error = new SyntaxError('Invalid JSON');
  let calls = 0;
  const gateway: RegisterUserGateway = {
    async registerUser() {
      calls += 1;
      throw error;
    },
  };

  await assert.rejects(createRegisterUser(gateway)(registration), (caught) => caught === error);
  assert.equal(calls, 1);
});

test('registration has no session or unrelated Auth workflow dependency', async () => {
  const calls: string[] = [];
  const gateway: RegisterUserGateway = {
    async registerUser() {
      calls.push('register');
      return { ok: true };
    },
  };

  await createRegisterUser(gateway)(registration);
  assert.deepEqual(calls, ['register']);
});

test('password change reads the token once and forwards exact input on success', async () => {
  const calls: string[] = [];
  const input = { currentPassword: ' Current1! ', newPassword: ' NewPass2! ' };
  const gateway: ChangePasswordGateway = {
    async changePassword(token, received) {
      calls.push('change');
      assert.equal(token, 'stored-token');
      assert.deepEqual(received, input);
      return { ok: true };
    },
  };
  const changePassword = createChangePassword(gateway, async () => {
    calls.push('read');
    return 'stored-token';
  });

  assert.deepEqual(await changePassword(input), { status: 'changed' });
  assert.deepEqual(calls, ['read', 'change']);
});

for (const token of [null, ''] as const) {
  test(`password change with ${token === null ? 'null' : 'empty'} token skips the gateway`, async () => {
    let reads = 0;
    const gateway: ChangePasswordGateway = {
      async changePassword() {
        assert.fail('gateway must not be called');
      },
    };
    const changePassword = createChangePassword(gateway, async () => {
      reads += 1;
      return token;
    });

    assert.deepEqual(await changePassword(passwords), { status: 'missing-token' });
    assert.equal(reads, 1);
  });
}

test('password change preserves backend rejection messages, including falsy values', async () => {
  for (const message of ['Rejected', '', undefined] as const) {
    const gateway: ChangePasswordGateway = {
      async changePassword() {
        return { ok: false, message };
      },
    };
    assert.deepEqual(
      await createChangePassword(gateway, async () => 'stored-token')(passwords),
      { status: 'rejected', message },
    );
  }
});

test('password change propagates the original token-read error without calling the gateway', async () => {
  const error = new Error('Read failed');
  const gateway: ChangePasswordGateway = {
    async changePassword() {
      assert.fail('gateway must not be called');
    },
  };

  await assert.rejects(
    createChangePassword(gateway, async () => { throw error; })(passwords),
    (caught) => caught === error,
  );
});

test('password change propagates the original gateway error', async () => {
  const error = new Error('Request failed');
  const gateway: ChangePasswordGateway = {
    async changePassword() {
      throw error;
    },
  };

  await assert.rejects(
    createChangePassword(gateway, async () => 'stored-token')(passwords),
    (caught) => caught === error,
  );
});
