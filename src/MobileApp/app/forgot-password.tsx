import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { requestPasswordRecovery } from '../src/di/auth';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const router = useRouter();

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
    <View style={styles.container}>
      {/* Strelica za povratak */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('forgotPasswordTitle')}</Text>
      <Text style={styles.subtitle}>{t('forgotPasswordSubtitle')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('emailPlaceholder')}
        placeholderTextColor="#9CA3AF"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TouchableOpacity style={styles.button} onPress={handleForgotPassword}>
        <Text style={styles.buttonText}>{t('sendResetLink')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F9FAFB' },
  backButton: {
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
    padding: 8,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
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
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
