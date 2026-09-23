import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  Animated,
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
import { registerUser } from '../src/di/auth';
import { theme } from '../constants/theme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (pw: string) => {
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw)
    );
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert(t('error'), t('allFieldsRequired'));
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert(t('error'), t('invalidEmail'));
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(t('error'), t('passwordRequirements'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordMismatch'));
      return;
    }

    try {
      const result = await registerUser({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      });

      if (result.status === 'rejected') {
        throw new Error((result.message as string) || t('genericError'));
      }

      Alert.alert(t('success'), t('accountCreated'), [
        {
          text: 'OK',
          onPress: () => router.replace('/login'),
        },
      ]);
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert(t('error'), error.message || t('genericError'));
    }
  };

  type CriteriaKey = 'length' | 'upperLower' | 'number' | 'special';

  const criteria: Record<CriteriaKey, boolean> = {
    length: password.length >= 8,
    upperLower: /[A-Z]/.test(password) && /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password),
  };

  const fadeAnims: Record<CriteriaKey, Animated.Value> = {
    length: useRef(new Animated.Value(0.3)).current,
    upperLower: useRef(new Animated.Value(0.3)).current,
    number: useRef(new Animated.Value(0.3)).current,
    special: useRef(new Animated.Value(0.3)).current,
  };

  useEffect(() => {
    (Object.keys(criteria) as CriteriaKey[]).forEach((key) => {
      Animated.timing(fadeAnims[key], {
        toValue: criteria[key] ? 1 : 0.3,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }, [password]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="person-add-outline" size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>{t('createAccount')}</Text>
        </View>

      <Text style={styles.label}>{t('personalInfo.firstName')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.firstNamePlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        value={firstName}
        onChangeText={setFirstName}
      />

      <Text style={styles.label}>{t('personalInfo.lastName')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.lastNamePlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        value={lastName}
        onChangeText={setLastName}
      />

      <Text style={styles.label}>{t('emailPlaceholder')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('emailPlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>{t('passwordPlaceholder')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('passwordPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
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

      <Text style={styles.requirementsTitle}>{t('passwordMust')}</Text>
      <View style={styles.requirements}>
        <Animated.Text
          style={[
            styles.reqItem,
            !criteria.length && styles.reqItemInactive,
            { opacity: fadeAnims.length },
          ]}
        >
          • {t('atLeast8')}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.reqItem,
            !criteria.upperLower && styles.reqItemInactive,
            { opacity: fadeAnims.upperLower },
          ]}
        >
          • {t('upperLower')}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.reqItem,
            !criteria.number && styles.reqItemInactive,
            { opacity: fadeAnims.number },
          ]}
        >
          • {t('atLeastOneNumber')}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.reqItem,
            !criteria.special && styles.reqItemInactive,
            { opacity: fadeAnims.special },
          ]}
        >
          • {t('oneSpecial')}
        </Animated.Text>
      </View>

      <Text style={styles.label}>{t('confirmPasswordPlaceholder')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('confirmPasswordPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          style={styles.visibilityButton}
        >
          <Ionicons
            name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{t('createAccount')}</Text>
      </TouchableOpacity>

      <View style={styles.loginPrompt}>
        <Text style={styles.loginLink}>{t('alreadyHaveAccount')}</Text>
        <Link href="/login" replace asChild>
          <TouchableOpacity>
            <Text style={styles.link}>{t('login')}</Text>
          </TouchableOpacity>
        </Link>
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
  label: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    maxWidth: 420,
    height: 48,
    alignSelf: 'center',
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
    width: '100%',
    maxWidth: 420,
    height: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  requirementsTitle: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  requirements: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.control,
  },
  reqItem: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  reqItemInactive: {
    color: theme.colors.textPrimary,
  },
  button: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    paddingVertical: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.control,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  loginPrompt: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  loginLink: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  link: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
