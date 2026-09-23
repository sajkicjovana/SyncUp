import type { Credentials } from '../../domain/auth';

export type LoginResult =
  | { ok: true; token?: string }
  | { ok: false; message?: string };

export type PasswordRecoveryResult =
  | { ok: true }
  | { ok: false; message?: string };

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordGatewayResult =
  | { ok: true }
  | { ok: false; message?: unknown };

export interface AuthGateway {
  login(credentials: Credentials): Promise<LoginResult>;
  isMobileUser(token: string): Promise<boolean>;
  requestPasswordReset(email: string): Promise<PasswordRecoveryResult>;
}

export interface ChangePasswordGateway {
  changePassword(token: string, input: ChangePasswordInput): Promise<ChangePasswordGatewayResult>;
}

export interface SessionStore {
  getToken(): Promise<string | null>;
  saveToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
}

export type ReadTokenExpiry = (token: string) => unknown;
export type NowSeconds = () => number;
export type ReadAuthToken = () => Promise<string | null>;
