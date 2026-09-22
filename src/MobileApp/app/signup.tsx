import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'expo-router';
import { router } from 'expo-router';
import { Animated } from 'react-native';
import { API_URL } from '../config';
import { apiCall } from '../config';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export default function SignUpScreen() {
  const { t } = useTranslation();

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
      const response = await apiCall(`${API_URL}/api/User/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
          role: 'MobileUser',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('genericError'));
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('createAccount')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.firstNamePlaceholder')}
        placeholderTextColor="#888"
        value={firstName}
        onChangeText={setFirstName}
      />

      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.lastNamePlaceholder')}
        placeholderTextColor="#888"
        value={lastName}
        onChangeText={setLastName}
      />

      <TextInput
        style={styles.input}
        placeholder={t('emailPlaceholder')}
        placeholderTextColor="#888"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('passwordPlaceholder')}
          placeholderTextColor="#888"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.toggleText}>{showPassword ? t('hide') : t('show')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.requirementsTitle}>{t('passwordMust')}</Text>
      <View style={styles.requirements}>
        <Animated.Text style={[styles.reqItem, { opacity: fadeAnims.length }]}>
          • {t('atLeast8')}
        </Animated.Text>
        <Animated.Text style={[styles.reqItem, { opacity: fadeAnims.upperLower }]}>
          • {t('upperLower')}
        </Animated.Text>
        <Animated.Text style={[styles.reqItem, { opacity: fadeAnims.number }]}>
          • {t('atLeastOneNumber')}
        </Animated.Text>
        <Animated.Text style={[styles.reqItem, { opacity: fadeAnims.special }]}>
          • {t('oneSpecial')}
        </Animated.Text>
      </View>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('confirmPasswordPlaceholder')}
          placeholderTextColor="#888"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          <Text style={styles.toggleText}>{showConfirmPassword ? t('hide') : t('show')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{t('createAccount')}</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center' }}>
        <Text style={styles.loginLink}>
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" replace asChild>
            <TouchableOpacity>
              <Text style={styles.link}>{t('login')}</Text>
            </TouchableOpacity>
          </Link>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
    color: '#111827',
  },
  input: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  toggleText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  requirementsTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 6,
    color: '#374151',
  },
  requirements: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  reqItem: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 3,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loginLink: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
  },
  link: {
    color: '#3B82F6',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
