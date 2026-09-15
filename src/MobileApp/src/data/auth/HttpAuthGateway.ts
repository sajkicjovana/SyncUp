import { API_URL, apiCall } from '../../../config';
import type { AuthGateway } from '../../application/auth/ports';

export const httpAuthGateway: AuthGateway = {
  async login({ email, password }) {
    const response = await apiCall(`${API_URL}/api/User/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, message: data.message ? String(data.message) : undefined };
    }
    return { ok: true, token: data.token };
  },

  async isMobileUser(token) {
    const response = await apiCall(`${API_URL}/api/User/role`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Greška pri proveri role');

    // Deliberately preserve the exact response-text comparison from the baseline.
    return (await response.text()) === '{"role":"MobileUser"}';
  },
};
