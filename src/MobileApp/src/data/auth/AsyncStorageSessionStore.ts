import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import type { ReadTokenExpiry, SessionStore } from '../../application/auth/ports';

export const asyncStorageSessionStore: SessionStore = {
  getToken: () => AsyncStorage.getItem('token'),
  saveToken: (token) => AsyncStorage.setItem('token', token),
  removeToken: () => AsyncStorage.removeItem('token'),
};

export const readTokenExpiry: ReadTokenExpiry = (token) => {
  const [, payloadBase64] = token.split('.');
  const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
  return JSON.parse(payloadJson).exp;
};
