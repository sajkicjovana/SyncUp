export type Credentials = {
  email: string;
  password: string;
};

export type CredentialError = 'missingFields' | 'invalidEmail' | 'invalidPassword';

export function validateCredentials({ email, password }: Credentials): CredentialError | null {
  if (!email || !password) return 'missingFields';
  if (!email.includes('@')) return 'invalidEmail';

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)
  ) {
    return 'invalidPassword';
  }

  return null;
}

export function isSessionUnexpired(expiry: unknown, nowSeconds: number): boolean {
  // Preserve the original truthiness/comparison semantics, including numeric strings.
  return Boolean(expiry && (expiry as number) > nowSeconds);
}
