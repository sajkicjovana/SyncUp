import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import en from './locales/en.json';
import sr from './locales/sr.json';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback: (lang: string) => void) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      callback('en');
      return;
    }

    const savedLang = await AsyncStorage.getItem('language');
    if (savedLang) {
      callback(savedLang);
    } else {
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (lang: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }

    await AsyncStorage.setItem('language', lang);
  },
};

i18n
  .use(languageDetector as any)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      sr: { translation: sr },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
