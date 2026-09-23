import React, { useEffect, useState } from 'react';
import i18n from '../i18n';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { useFavorites } from '../context/FavoriteContext';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import type { ProfileDashboardUpdate } from '../../src/application/profile/ports';
import { ProfileDashboardTokenReadError } from '../../src/application/profile/useCases';
import { discardCurrentSession } from '../../src/di/auth';
import { loadProfileDashboard } from '../../src/di/profile';

export default function ProfileScreen() {
  const router = useRouter();
  const rootNavigation = useNavigation('/');
  const { favorites, clearFavorites, setGuestMode } = useFavorites();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [ticketsCount, setTicketsCount] = useState(0);
  const [resourcesCount, setResourcesCount] = useState(0);

  const [credits, setCredits] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const defaultAvatar = require('../../assets/images/avatar_placeholder.png');

  const [selectedLang, setSelectedLang] = useState<'en' | 'sr'>('en');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

useEffect(() => {
    const fetchUserDataAndStats = async () => {
      try {
        const result = await loadProfileDashboard((update: ProfileDashboardUpdate) => {
          if (update.stage === 'authenticated') {
            setIsLoggedIn(true);
            setIsLoading(true);
          } else if (update.stage === 'profile') {
            if (update.outcome === 'loaded') {
              setFirstName(update.profile.firstName);
              setLastName(update.profile.lastName);
              setEmail(update.profile.email);
              setProfilePicture(update.profile.profilePicture);
            } else {
              console.error('Failed to fetch profile data:', update.status);
            }
          } else if (update.stage === 'tickets') {
            if (update.outcome === 'loaded') setTicketsCount(update.count);
            else console.error('Failed to fetch tickets:', undefined);
          } else if (update.stage === 'reservations') {
            if (update.outcome === 'loaded') setResourcesCount(update.count);
            else console.error('Failed to fetch resources:', undefined);
          } else if (update.outcome === 'loaded') {
            setCredits(update.credits);
          } else if (update.outcome === 'invalid') {
            console.warn('Credits field is missing or not a number:', update.invalidValue);
            setCredits(0);
          } else {
            console.error('Failed to fetch credits. Status:', update.status);
            console.error('Response text:', update.responseText);
            setCredits(0);
          }
        });

        if (result.status === 'missing-token') {
          setIsLoggedIn(false);
        }
      } catch (err) {
        if (err instanceof ProfileDashboardTokenReadError) throw err.originalError;
        console.error('An unexpected error occurred during API calls:', err);
        // U slučaju bilo kakve greške, postavi kredite na 0 i prikaži grešku
        setCredits(0); 
      } finally {
        setIsLoading(false);
      }
    };

    const fetchLanguage = async () => {
      setSelectedLang(i18n.language === 'sr' ? 'sr' : 'en');
    };

    fetchUserDataAndStats();
    fetchLanguage();
  }, []);

  const handleLanguageSwitch = async (lang: 'en' | 'sr') => {
    await i18n.changeLanguage(lang);
    await i18n.services.languageDetector.cacheUserLanguage(lang);
    setSelectedLang(lang);
    setLanguageModalVisible(false);
  };
  const handleLogout = () => {
    Alert.alert(
      t('profile.logoutTitle'),
      t('profile.logoutConfirm'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await discardCurrentSession();
              clearFavorites();
              setGuestMode(true);
              rootNavigation.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: 'index' }] })
              );
            } catch (err) {
              console.error('Error during logout:', err);
              Alert.alert(t('profile.error'), t('profile.logoutError'));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderProfileImage = () => (
    <TouchableOpacity onPress={() => setImageModalVisible(true)}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#fff" style={{ width: 68, height: 68 }} />
      ) : (
        <Image
          source={profilePicture ? { uri: profilePicture } : defaultAvatar}
          style={styles.avatarImage}
        />
      )}
    </TouchableOpacity>
  );

  if (!isLoggedIn) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.header}>{t('profile.notLoggedIn')}</Text>
        <Text style={styles.message}>{t('profile.loginPrompt')}</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginText}>{t('profile.loginNow')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('profile.title')}</Text>

      <View style={styles.profileCard}>
  {renderProfileImage()}
  <View style={{ flex: 1, marginLeft: 16 }}>
    <Text style={styles.name}>{`${firstName} ${lastName}`}</Text>
    <Text style={styles.email}>{email}</Text>
    <Text style={styles.credits}>{credits} RSD</Text>
  </View>
</View>

      <View style={styles.rowContainer}>
        <TouchableOpacity
          style={styles.statBox}
          onPress={() =>
            router.push({
              pathname: '../profile/myTickets',
              params: { from: 'profile' }, 
            })
          }
        >
          <Text style={styles.statNumber}>{ticketsCount}</Text>
          <Text style={styles.statLabel}>{t('profile.tickets')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statBox}
          onPress={() =>
            router.push({
              pathname: '../profile/myReservations',
              params: { from: 'profile' }, 
            })
          }
              >
          <Text style={styles.statNumber}>{resourcesCount}</Text>
          <Text style={styles.statLabel}>{t('profile.myReservations')}</Text>
        </TouchableOpacity>



        <TouchableOpacity
          style={styles.statBox}
          onPress={() =>
            router.navigate({
              pathname: '/(tabs)/favorites',
              params: { from: 'profile' },
            })
          }
        >
          <Text style={styles.statNumber}>{favorites.length}</Text>
          <Text style={styles.statLabel}>{t('profile.favorites')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t('profile.accountSettings')}</Text>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/personal-info')}>
        <Text>👤 {t('profile.personalInfo')}</Text>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/token')}>
        <Text>💳 {t('profile.payment')}</Text>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/change-password')}>
        <Text>🔒 {t('profile.changePassword')}</Text>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t('profile.application')}</Text>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/about')}>
        <Text>❓ {t('profile.about')}</Text>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => setLanguageModalVisible(true)}>
        <Text>🌐 {t('profile.language')}</Text>
        <Text style={styles.optionArrow}>
          {selectedLang === 'en' ? '🇬🇧' : '🇷🇸'} ›
        </Text>
      </TouchableOpacity>


      <TouchableOpacity style={styles.option} onPress={handleLogout}>
        <Text style={{ color: 'red' }}>🚪 {t('profile.logout')}</Text>
        <Text style={[styles.optionArrow, { color: 'red' }]}>›</Text>
      </TouchableOpacity>

      <Modal visible={imageModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setImageModalVisible(false)}>
          <View style={styles.modalContent}>
            <Image
              source={profilePicture ? { uri: profilePicture } : defaultAvatar}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        </Pressable>
      </Modal>
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
      <View style={styles.modalContent1}>
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

import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: width * 0.06, // ~6% širine ekrana
    paddingTop: height * 0.05,
    paddingBottom: height * 0.02,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: width * 0.06,
    fontWeight: '900',
    marginBottom: height * 0.01,
    textAlign: 'center',
    color: '#1a202c',
    letterSpacing: 0.8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    padding: width * 0.04,
    marginBottom: height * 0.025,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 10,
  },
  avatarImage: {
    width: width * 0.18,
    height: width * 0.18,
    borderRadius: width * 0.09,
    backgroundColor: '#eee',
  },
  name: {
    color: 'white',
    fontWeight: '900',
    fontSize: width * 0.05,
  },
  email: {
    color: 'white',
    fontSize: width * 0.04,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  credits: {
    color: 'white',
    fontSize: width * 0.045,
    fontWeight: '700',
    marginTop: 2,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: height * 0.03,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: height * 0.02,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#edeff1ff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    minHeight: height * 0.12,
  },
  statNumber: {
    fontSize: width * 0.07,
    fontWeight: '900',
    marginBottom: 4,
    color: '#4a5568',
  },
  statLabel: {
    fontSize: width * 0.035,
    color: '#6b7280',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: width * 0.045,
    fontWeight: '900',
    marginBottom: 8,
    color: '#2d3748',
  },
  option: {
    backgroundColor: '#edeff1ff',
    paddingVertical: height * 0.018,
    paddingHorizontal: width * 0.04,
    borderRadius: 14,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  optionArrow: {
    fontSize: width * 0.05,
    fontWeight: '700',
    color: '#9ca3af',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: width * 0.06,
  },
  message: {
    fontSize: width * 0.04,
    color: '#555',
    textAlign: 'center',
    marginBottom: height * 0.03,
  },
  loginButton: {
    backgroundColor: '#6d28d9',
    paddingVertical: height * 0.018,
    paddingHorizontal: width * 0.1,
    borderRadius: 30,
    alignSelf: 'center',
    shadowColor: '#6d28d9',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 7,
  },
  loginText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: width * 0.045,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalImage: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 12,
  },
  modalContent1: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    width: width * 0.4,
    elevation: 4,
  },
  langOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: width * 0.04,
    fontWeight: '500',
  },
});



