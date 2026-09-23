import { createChangePassword, createReadAuthToken, createRegisterUser, createRequestPasswordRecovery, createRestoreSession, createSignIn, discardSession as discardSessionUseCase } from '../application/auth/useCases';
import { httpAuthGateway } from '../data/auth/HttpAuthGateway';
import { asyncStorageSessionStore, readTokenExpiry } from '../data/auth/AsyncStorageSessionStore';

export const signIn = createSignIn(httpAuthGateway, asyncStorageSessionStore);
export const requestPasswordRecovery = createRequestPasswordRecovery(httpAuthGateway);
export const registerUser = createRegisterUser(httpAuthGateway);
export const changePassword = createChangePassword(httpAuthGateway, asyncStorageSessionStore.getToken);
export const readAuthToken = createReadAuthToken(asyncStorageSessionStore.getToken);
export const discardCurrentSession = () => discardSessionUseCase(asyncStorageSessionStore);
export const discardStartupSession = () => discardCurrentSession();
export const restoreSession = createRestoreSession(
  asyncStorageSessionStore,
  readTokenExpiry,
  () => Math.floor(Date.now() / 1000),
);
