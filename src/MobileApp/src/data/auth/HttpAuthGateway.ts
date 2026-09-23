import { API_URL, apiCall } from '../../../config';
import type { AuthGateway, ChangePasswordGateway } from '../../application/auth/ports';

export const httpAuthGateway: AuthGateway & ChangePasswordGateway = {
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
  async requestPasswordReset(email) {
    const response = await apiCall(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data: any = await response.json();
      return { ok: false, message: data.message ? String(data.message) : undefined };
    }
    return { ok: true };
  },
  async changePassword(token, { currentPassword, newPassword }) {
    const response = await apiCall(`${API_URL}/api/User/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    let data: any;
    const raw = await response.text();
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }

    if (response.ok) return { ok: true };
    return { ok: false, message: data.message };
  },
};
