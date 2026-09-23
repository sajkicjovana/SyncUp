import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { purchaseCredits } from '../../src/di/profile';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';

export default function TokenPurchaseScreen() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const handlePurchase = async () => {
  const parsedAmount = parseInt(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    Alert.alert(`${t('error')}`, `${t('payment.errorNumber')}`);
    return;
  }

  try {
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulacija animacije

    setLoading(true);
    const result = await purchaseCredits(parsedAmount);

    if (result.ok) {
      Alert.alert(
        `${t('payment.success')}`,
        `${parsedAmount} ${t('payment.success2')}`
      );
      setAmount('');
    } else {
      const errorText = result.responseText;
      if (errorText.includes("Credit cannot exceed")) {
        Alert.alert(`${t('error')}`, `${t('payment.moneyError')}`);
      } else {
        Alert.alert(`${t('error')}`, `${t('payment.errorPayment')}`);
      }
    }
  } catch (error) {
    Alert.alert(`${t('error')}`, `${t('payment.errorServer')}`);
  } finally {
    setLoading(false);
    setProcessing(false);
  }
};


  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.push('../(tabs)/profile')}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>{t('payment.header').replace('💸', '').trim()}</Text>

      <View style={styles.sectionHeading}>
        <Ionicons name="wallet-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.label}>{t('payment.msg')}</Text>
      </View>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder={t('payment.example')}
      />

      {processing && (
        <Animatable.View
          animation="pulse"
          easing="ease-in-out"
          iterationCount="infinite"
          style={styles.cardAnimation}
        >
          <Ionicons name="card-outline" size={60} color={theme.colors.primary} />
          <Text style={styles.processingText}>{t('payment.process')}</Text>
        </Animatable.View>
      )}

      <TouchableOpacity style={styles.btn} onPress={handlePurchase} disabled={loading || processing}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>{t('payment.button')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screen,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.control,
    marginBottom: theme.spacing.lg,
    height: 48,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.control,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  cardAnimation: {
    alignItems: 'center',
    marginVertical: 20,
  },
  processingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
});
