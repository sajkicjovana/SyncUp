import AsyncStorage from '@react-native-async-storage/async-storage';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!apiUrl) {
  throw new Error('Set EXPO_PUBLIC_API_URL in .env.local before starting SyncUp.');
}
export const API_URL = apiUrl.replace(/\/+$/, '');
export const apiCall = async (url: string, options: RequestInit = {}) => {
  const lang = await AsyncStorage.getItem('language') || 'sr'; // default sr
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Accept-Language': lang,
    },
  });
};
