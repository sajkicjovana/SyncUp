import { isSessionUnexpired, validateCredentials } from '../../domain/auth';
import type { CredentialError, Credentials } from '../../domain/auth';
import type {
  AuthGateway,
  ChangePasswordGateway,
  ChangePasswordInput,
  NowSeconds,
  ReadAuthToken,
  ReadTokenExpiry,
  RegisterUserGateway,
  RegistrationInput,
  SessionStore,
} from './ports';

export type SignInResult =
  | { status: 'invalid-credentials'; reason: CredentialError }
  | { status: 'login-rejected'; message?: string }
  | { status: 'missing-token' }
  | { status: 'not-mobile-user' }
  | { status: 'signed-in' }
  | { status: 'failure'; message?: string };

export function createSignIn(gateway: AuthGateway, store: SessionStore) {
  return async (credentials: Credentials): Promise<SignInResult> => {
    const reason = validateCredentials(credentials);
    if (reason) return { status: 'invalid-credentials', reason };

    try {
      const result = await gateway.login(credentials);
      if (!result.ok) return { status: 'login-rejected', message: result.message };
      if (!result.token) return { status: 'missing-token' };
      if (!(await gateway.isMobileUser(result.token))) return { status: 'not-mobile-user' };

      await store.saveToken(result.token);
      return { status: 'signed-in' };
    } catch (error) {
      return { status: 'failure', message: (error as { message?: string } | null)?.message };
    }
  };
}
export function createRequestPasswordRecovery(gateway: AuthGateway) {
  return (email: string) => gateway.requestPasswordReset(email);
}

export type RegisterUserResult =
  | { status: 'registered' }
  | { status: 'rejected'; message?: unknown };

export function createRegisterUser(gateway: RegisterUserGateway) {
  return async (input: RegistrationInput): Promise<RegisterUserResult> => {
    const result = await gateway.registerUser(input);
    if (!result.ok) return { status: 'rejected', message: result.message };
    return { status: 'registered' };
  };
}

export type ChangePasswordResult =
  | { status: 'missing-token' }
  | { status: 'changed' }
  | { status: 'rejected'; message?: unknown };

export function createReadAuthToken(readToken: ReadAuthToken): ReadAuthToken {
  return () => readToken();
}

export function createChangePassword(
  gateway: ChangePasswordGateway,
  readToken: ReadAuthToken,
) {
  return async (input: ChangePasswordInput): Promise<ChangePasswordResult> => {
    const token = await readToken();
    if (!token) return { status: 'missing-token' };

    const result = await gateway.changePassword(token, input);
    if (!result.ok) return { status: 'rejected', message: result.message };
    return { status: 'changed' };
  };
}


export type RestoreSessionResult =
  | { status: 'authenticated'; token: string }
  | { status: 'unauthenticated' };

export function discardSession(store: SessionStore): Promise<void> {
  return store.removeToken();
}

export function createRestoreSession(
  store: SessionStore,
  readTokenExpiry: ReadTokenExpiry,
  nowSeconds: NowSeconds,
) {
  return async (): Promise<RestoreSessionResult> => {
    try {
      const token = await store.getToken();
      if (token) {
        if (isSessionUnexpired(readTokenExpiry(token), nowSeconds())) {
          return { status: 'authenticated', token };
        }
        await store.removeToken();
      }
    } catch {
      // Match startup cleanup after a read/decode failure (and retry a failed removal).
      await store.removeToken();
    }
    return { status: 'unauthenticated' };
  };
}
