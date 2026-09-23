import React, { useState } from 'react';
import { apiCall } from '../../config';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { API_URL } from '../../config';

export default function AboutSyncUpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [imageLoading, setImageLoading] = useState(true); // ✅ Sada unutar komponente

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/profile')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          <Text style={styles.backText}></Text>
        </TouchableOpacity>
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>SyncUp</Text>
        </View>
      </View>

      <View style={{ position: 'relative' }}>
        {imageLoading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        <Image
          source={{
            uri: `${API_URL}/images/about/syncup-logo.png`,
          }}
          style={styles.image}
          onLoadEnd={() => setImageLoading(false)}
        />
      </View>

      <Text style={styles.heading}>{t('aboutScreen.heading')}</Text>
      <Text style={styles.paragraph}>{t('aboutScreen.description')}</Text>

      <View style={styles.sectionHeading}>
        <Ionicons name="sparkles-outline" size={19} color={theme.colors.primary} />
        <Text style={styles.subheading}>{t('aboutScreen.missionTitle').replace('🌟', '').trim()}</Text>
      </View>
      <Text style={styles.paragraph}>{t('aboutScreen.missionText')}</Text>

      <View style={styles.sectionHeading}>
        <Ionicons name="rocket-outline" size={19} color={theme.colors.primary} />
        <Text style={styles.subheading}>{t('aboutScreen.whyTitle').replace('🚀', '').trim()}</Text>
      </View>
      <Text style={styles.paragraph}>{t('aboutScreen.whyText')}</Text>

      <View style={styles.sectionHeading}>
        <Ionicons name="location-outline" size={19} color={theme.colors.primary} />
        <Text style={styles.subheading}>{t('aboutScreen.locationTitle').replace('📍', '').trim()}</Text>
      </View>
      <Text style={styles.paragraph}>{t('aboutScreen.locationText')}</Text>

      <View style={styles.sectionHeading}>
        <Ionicons name="mail-outline" size={19} color={theme.colors.primary} />
        <Text style={styles.subheading}>{t('aboutScreen.contactTitle').replace('📬', '').trim()}</Text>
      </View>
      <Text style={styles.paragraph}>{t('aboutScreen.contactText')}</Text>

      <Text style={styles.footer}>{t('aboutScreen.footer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.screen,
    backgroundColor: theme.colors.background,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    marginLeft: 6,
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: '500',
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    marginLeft: -50,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: theme.radii.card,
    marginBottom: theme.spacing.lg,
  },
  loader: {
    position: 'absolute',
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: theme.colors.textPrimary,
  },
  subheading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  footer: {
    marginTop: 30,
    fontSize: 13,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
});
