import { isSessionUnexpired, validateCredentials } from '../../domain/auth';
import type { CredentialError, Credentials } from '../../domain/auth';
import type { AuthGateway, NowSeconds, ReadTokenExpiry, SessionStore } from './ports';

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
