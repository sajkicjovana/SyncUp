import type { Credentials } from '../../domain/auth';

export type LoginResult =
  | { ok: true; token?: string }
  | { ok: false; message?: string };

export interface AuthGateway {
  login(credentials: Credentials): Promise<LoginResult>;
  isMobileUser(token: string): Promise<boolean>;
}

export interface SessionStore {
  getToken(): Promise<string | null>;
  saveToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
}

export type ReadTokenExpiry = (token: string) => unknown;
export type NowSeconds = () => number;
