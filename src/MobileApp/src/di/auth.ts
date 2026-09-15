import { createRestoreSession, createSignIn, discardSession } from '../application/auth/useCases';
import { httpAuthGateway } from '../data/auth/HttpAuthGateway';
import { asyncStorageSessionStore, readTokenExpiry } from '../data/auth/AsyncStorageSessionStore';

export const signIn = createSignIn(httpAuthGateway, asyncStorageSessionStore);
export const discardStartupSession = () => discardSession(asyncStorageSessionStore);
export const restoreSession = createRestoreSession(
  asyncStorageSessionStore,
  readTokenExpiry,
  () => Math.floor(Date.now() / 1000),
);
