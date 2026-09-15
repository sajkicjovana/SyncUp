import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { discardStartupSession, restoreSession } from '../src/di/auth';

export default function HomeScreen() {
  const { t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState<'en' | 'sr'>('en');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => {
    setSelectedLang(i18n.language === 'sr' ? 'sr' : 'en');

    const checkToken = async () => {
      const result = await restoreSession();
      if (result.status === 'authenticated') {
        try {
          router.replace('./(tabs)/events');
        } catch {
          // Preserve the baseline cleanup if startup navigation throws.
          await discardStartupSession();
        }
      }
    };

    checkToken();
  }, []);

  const handleLanguageSwitch = async (lang: 'en' | 'sr') => {
    await i18n.changeLanguage(lang);
    await i18n.services.languageDetector.cacheUserLanguage(lang);
    setSelectedLang(lang);
    setLanguageModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.langMenu}>
        <TouchableOpacity
          onPress={() => setLanguageModalVisible(true)}
          style={styles.langToggle}
        >
          <Text style={styles.langEmoji}>
            {selectedLang === 'en' ? '🇬🇧' : '🇷🇸'}
          </Text>
        </TouchableOpacity>
      </View>

      <Image
        source={require('../assets/images/SyncUpLogo.png')}
        style={styles.icon}
      />

      <Text style={styles.subtitle}>Discover the World at Your Fingertips</Text>

      <Link href="/login" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>{t('home.login_signup')}</Text>
        </TouchableOpacity>
      </Link>

      <Link href="/guest" asChild>
        <TouchableOpacity>
          <Text style={styles.guestText}>{t('home.guest_mode')}</Text>
        </TouchableOpacity>
      </Link>

      <Modal
        transparent
        animationType="fade"
        visible={languageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.langOption}
              onPress={() => handleLanguageSwitch('en')}
            >
              <Text style={styles.optionText}>🇬🇧 English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langOption}
              onPress={() => handleLanguageSwitch('sr')}
            >
              <Text style={styles.optionText}>🇷🇸 Srpski</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  langMenu: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  langToggle: {
    backgroundColor: '#EEE',
    padding: 10,
    borderRadius: 20,
    width: 50,
    alignItems: 'center',
  },
  langEmoji: {
    fontSize: 20,
  },
  icon: {
    width: 250,
    height: 250,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#555',
    fontWeight: '500',
    marginVertical: 20,
    fontStyle: 'italic',
    lineHeight: 26,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#7069E1',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: 300,
    marginTop: 40,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  guestText: {
    color: '#333',
    textDecorationLine: 'underline',
    marginTop: 10,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    width: 150,
    elevation: 4,
  },
  langOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
