import { API_URL, apiCall } from '../../../config';
import type { ProfileDashboardGateway } from '../../application/profile/ports';

type ProfileDto = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phoneNumber?: unknown;
  profilePicture?: unknown;
};

function normalizeImageUrl(path: any): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const httpProfileDashboardGateway: ProfileDashboardGateway = {
  async loadCurrentProfile(token) {
    const response = await apiCall(`${API_URL}/api/MobileUser/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return { ok: false, status: response.status };

    const data: ProfileDto = await response.json();
    return {
      ok: true,
      profile: {
        firstName: (data.firstName || '') as string,
        lastName: (data.lastName || '') as string,
        email: (data.email || '') as string,
        phoneNumber: (data.phoneNumber || '') as string,
        profilePicture: normalizeImageUrl(data.profilePicture || null),
      },
    };
  },

  async loadCredits(token) {
    const response = await apiCall(`${API_URL}/api/Credit`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        responseText: await response.text(),
      };
    }

    const data = await response.json();
    return { ok: true, credits: data?.credits };
  },
};
