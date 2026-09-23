import React, { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavorites } from './context/FavoriteContext';
import { signIn } from '../src/di/auth';
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
import { useTranslation } from 'react-i18next';
import { theme } from '../constants/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { loadFavorites } = useFavorites();

  const handleLogin = async () => {
    try {
      const result = await signIn({ email, password });
      switch (result.status) {
        case 'invalid-credentials':
          if (result.reason === 'missingFields') {
            Alert.alert(t('error'), t('fillAllFields'));
          } else {
            Alert.alert(t('loginFailed'), t(result.reason));
          }
          return;
        case 'login-rejected': {
          let message = result.message || t('loginFailed');
          if (message === 'Email address not verified. Please check your email and verify your account.') {
            message = t('accountNotVerified');
          }
          Alert.alert(t('loginError'), message);
          return;
        }
        case 'missing-token':
          Alert.alert(t('error'), t('noToken'));
          return;
        case 'not-mobile-user':
          Alert.alert(t('error'), t('mobileroleLogin'));
          return;
        case 'failure':
          Alert.alert(t('loginError'), result.message || t('genericError'));
          return;
        case 'signed-in':
          loadFavorites();
          router.replace('./(tabs)/events');
          return;
      }
    } catch (error: any) {
      Alert.alert(t('loginError'), error.message || t('genericError'));
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
          <View style={styles.headerIcon}>
            <Ionicons name="person-outline" size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>{t('welcomeToSyncUp')}</Text>
        </View>

        <View style={styles.formCard}>
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

          <Text style={styles.label}>{t('passwordPlaceholder')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t('passwordPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showPassword}
              onChangeText={setPassword}
              value={password}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.visibilityButton}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('./forgot-password')}>
            <Text style={styles.forgot}>{t('forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginText}>{t('login')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => router.replace('/signup')}
          >
            <Text style={styles.signupText}>{t('signup')}</Text>
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
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.screen,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.round,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
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
  passwordContainer: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
  },
  passwordInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  visibilityButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgot: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.control,
  },
  loginText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  signupButton: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.control,
  },
  signupText: {
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: '700',
  },
});
