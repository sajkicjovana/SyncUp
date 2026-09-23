import { API_URL, apiCall } from '../../../config';
import type { PersonalInfoMutationGateway } from '../../application/profile/ports';

function normalizeImageUrl(path: any): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const httpPersonalInfoGateway: PersonalInfoMutationGateway = {
  async updateProfile(token, profile) {
    const response = await apiCall(`${API_URL}/api/MobileUser/profileUpdate`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        profilePicture: profile.profilePicture,
      }),
    });

    if (response.ok) return { ok: true };

    const error = await response.json();
    return { ok: false, backendMessage: error.message };
  },

  async uploadProfileImage(token, uri) {
    const formData = new FormData();
    // @ts-ignore React Native FormData accepts file descriptor objects.
    formData.append('Image', {
      uri,
      name: 'profile.jpg',
      type: 'image/jpeg',
    });

    const response = await fetch(`${API_URL}/api/MobileUser/profile-image`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      return { ok: false, responseText: await response.text() };
    }

    const data = await response.json();
    return {
      ok: true,
      imageUrl: normalizeImageUrl(data.imageUrl || null),
    };
  },

  async deleteProfileImage(token) {
    const response = await apiCall(
      `${API_URL}/api/MobileUser/delete-profile-picture`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      return { ok: false, responseText: await response.text() };
    }

    return { ok: true };
  },
};
