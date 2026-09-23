
import React, { useState } from 'react';
import { changePassword } from '../../src/di/auth';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validatePassword = (password: string) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)
    );
  };

const handleChangePassword = async () => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    Alert.alert(
      t('changePassword.error'),
      t('changePassword.allFieldsRequired')
    );
    return;
  }

  if (!validatePassword(newPassword)) {
    Alert.alert(
      t('changePassword.invalidPasswordTitle'),
      t('changePassword.invalidPasswordMessage')
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    Alert.alert(
      t('changePassword.error'),
      t('changePassword.passwordMismatch')
    );
    return;
  }

  try {
    const result = await changePassword({ currentPassword, newPassword });
    if (result.status === 'missing-token') {
      Alert.alert(
        t('changePassword.error'),
        t('changePassword.notLoggedIn')
      );
      return;
    }

    if (result.status === 'changed') {
      Alert.alert(
        t('changePassword.success'),
        t('changePassword.passwordChanged')
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.push('../(tabs)/profile');
    } else {
      // mapiranje poruka na lokalizovane stringove
      const backendMessage = result.message as any;
      let message = backendMessage;

      if (backendMessage === "The current password is incorrect.") {
        message = t('changePassword.currentPasswordIncorrect');
      } else if (
        backendMessage?.includes("The new password must be at least 8 characters long")
      ) {
        message = t('changePassword.invalidPasswordMessage');
      }

      Alert.alert(
        t('changePassword.error'),
        message || t('changePassword.changeFailed')
      );
    }
  } catch (error) {
    Alert.alert(
      t('changePassword.error'),
      t('changePassword.errorServer')
    );
  }
};




  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('../(tabs)/profile')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{t('changePassword.title')}</Text>
        </View>
      </View>

      <Text style={styles.label}>{t('changePassword.currentPassword')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={!showCurrent}
        />
        <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
          <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{t('changePassword.newPassword')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showNew}
        />
        <TouchableOpacity onPress={() => setShowNew(!showNew)}>
          <Ionicons name={showNew ? 'eye-off' : 'eye'} size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{t('changePassword.confirmPassword')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirm}
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
          <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
        <Text style={styles.saveText}>{t('changePassword.saveChanges')}</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    paddingRight: 10,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    marginRight: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827', 
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

