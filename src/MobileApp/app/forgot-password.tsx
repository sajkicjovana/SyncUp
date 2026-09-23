import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { requestPasswordRecovery } from '../src/di/auth';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleForgotPassword = async () => {
    if (!email.includes('@')) {
      Alert.alert(t('error'), t('invalidEmail'));
      return;
    }

    try {
      const result = await requestPasswordRecovery(email);
      if (!result.ok) throw new Error(result.message || t('genericError'));

      Alert.alert(t('success'), t('resetLinkSent'));
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('genericError'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('forgotPasswordTitle')}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="key-outline" size={26} color={theme.colors.primary} />
          </View>
          <Text style={styles.subtitle}>{t('forgotPasswordSubtitle')}</Text>

          <Text style={styles.label}>{t('emailPlaceholder')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('emailPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={setEmail}
            value={email}
          />

          <TouchableOpacity style={styles.button} onPress={handleForgotPassword}>
            <Text style={styles.buttonText}>{t('sendResetLink')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    marginRight: 44,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  iconContainer: {
    width: 52,
    height: 52,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.round,
  },
  subtitle: {
    marginBottom: theme.spacing.xl,
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  label: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 48,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.control,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
