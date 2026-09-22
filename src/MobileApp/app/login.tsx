import React, { useState } from 'react';
import { router } from 'expo-router';
import { useFavorites } from './context/FavoriteContext';
import { signIn } from '../src/di/auth';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const { t } = useTranslation();
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
    <View style={styles.container}>
      <Text style={styles.title}>{t('welcomeToSyncUp')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('emailPlaceholder')}
        placeholderTextColor="#9CA3AF" 
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('passwordPlaceholder')}
          placeholderTextColor="#9CA3AF" 
          secureTextEntry={!showPassword}
          onChangeText={setPassword}
          value={password}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.toggleText}>
            {showPassword ? t('hide') : t('show')}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
                onPress={() => router.push('./forgot-password')} >
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 32,
    textAlign: 'center',
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
  forgot: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 28,
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  loginText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  signupButton: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  signupText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 16,
  },
});
