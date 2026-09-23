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

export default function TokenPurchaseScreen() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
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
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.push('../(tabs)/profile')}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      <Text style={styles.title}>{t('payment.header')}</Text>

      <Text style={styles.label}>{t('payment.msg')}</Text>
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
          <Ionicons name="card-outline" size={60} color="#0066cc" />
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
    backgroundColor: '#fdfdfd',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#1e1e1e',
  },
  label: {
    fontSize: 18,
    color: '#444',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#0066cc',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  cardAnimation: {
    alignItems: 'center',
    marginVertical: 20,
  },
  processingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
});
