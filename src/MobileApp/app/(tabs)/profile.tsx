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
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../context/FavoriteContext';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import type { ProfileDashboardUpdate } from '../../src/application/profile/ports';
import { ProfileDashboardTokenReadError } from '../../src/application/profile/useCases';
import { discardCurrentSession } from '../../src/di/auth';
import { loadProfileDashboard } from '../../src/di/profile';
import { theme } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.centeredContainer, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.header}>{t('profile.notLoggedIn')}</Text>
        <Text style={styles.message}>{t('profile.loginPrompt')}</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginText}>{t('profile.loginNow')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.header}>{t('profile.title')}</Text>

      <View style={styles.profileCard}>
        {renderProfileImage()}
        <View style={styles.profileDetails}>
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
          <Ionicons name="ticket-outline" size={20} color={theme.colors.primary} />
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
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
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
          <Ionicons name="heart-outline" size={20} color={theme.colors.favorite} />
          <Text style={styles.statNumber}>{favorites.length}</Text>
          <Text style={styles.statLabel}>{t('profile.favorites')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t('profile.accountSettings')}</Text>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/personal-info')}>
        <Ionicons name="person-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.optionLabel}>{t('profile.personalInfo')}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/token')}>
        <Ionicons name="card-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.optionLabel}>{t('profile.payment')}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/change-password')}>
        <Ionicons name="lock-closed-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.optionLabel}>{t('profile.changePassword')}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t('profile.application')}</Text>

      <TouchableOpacity style={styles.option} onPress={() => router.push('../profile/about')}>
        <Ionicons name="information-circle-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.optionLabel}>{t('profile.about')}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => setLanguageModalVisible(true)}>
        <Ionicons name="language-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.optionLabel}>{t('profile.language')}</Text>
        <Text style={styles.languageValue}>
          {selectedLang === 'en' ? '🇬🇧' : '🇷🇸'} ›
        </Text>
      </TouchableOpacity>


      <TouchableOpacity style={[styles.option, styles.logoutOption]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={21} color="#C53030" />
        <Text style={[styles.optionLabel, styles.logoutText]}>{t('profile.logout')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#C53030" />
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

    </ScrollView>
  );
}

import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    backgroundColor: theme.colors.background,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.divider,
  },
  name: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 20,
  },
  email: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  credits: {
    color: theme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
  },
  profileDetails: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 104,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
  },
  option: {
    backgroundColor: theme.colors.surface,
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  languageValue: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  logoutOption: {
    marginTop: theme.spacing.sm,
  },
  logoutText: {
    color: '#C53030',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screen,
  },
  message: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radii.control,
    alignSelf: 'center',
  },
  loginText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
