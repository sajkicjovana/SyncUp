import React, { useState, useEffect } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { discardStartupSession, restoreSession } from '../src/di/auth';
import { theme } from '../constants/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.langMenu, { top: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity
          onPress={() => setLanguageModalVisible(true)}
          style={styles.langToggle}
          activeOpacity={0.7}
        >
          <Ionicons name="language-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.langCode}>{selectedLang.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Image
          source={require('../assets/images/SyncUpLogo.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Discover the World at Your Fingertips</Text>
      </View>

      <View style={styles.actions}>
        <Link href="/login" asChild>
          <TouchableOpacity style={styles.button} activeOpacity={0.8}>
            <Ionicons name="log-in-outline" size={20} color={theme.colors.surface} />
            <Text style={styles.buttonText}>{t('home.login_signup')}</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/guest" asChild>
          <TouchableOpacity style={styles.guestButton} activeOpacity={0.7}>
            <Ionicons name="compass-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.guestText}>{t('home.guest_mode')}</Text>
          </TouchableOpacity>
        </Link>
      </View>

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
          <View style={[styles.modalContent, { marginTop: insets.top + 52 }]}>
            <TouchableOpacity
              style={styles.langOption}
              onPress={() => handleLanguageSwitch('en')}
            >
              <Text style={styles.optionText}>English</Text>
              {selectedLang === 'en' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langOption}
              onPress={() => handleLanguageSwitch('sr')}
            >
              <Text style={styles.optionText}>Srpski</Text>
              {selectedLang === 'sr' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    minHeight: '100%',
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.screen,
  },
  langMenu: {
    position: 'absolute',
    right: theme.spacing.screen,
    zIndex: 1,
  },
  langToggle: {
    minWidth: 72,
    height: 40,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.round,
  },
  langCode: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
  },
  icon: {
    width: 220,
    height: 180,
  },
  subtitle: {
    maxWidth: 300,
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xxl,
  },
  button: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.control,
  },
  buttonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  guestButton: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.control,
  },
  guestText: {
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 42, 67, 0.24)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: theme.spacing.screen,
  },
  modalContent: {
    width: 160,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  langOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  optionText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
