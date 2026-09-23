import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { loadPersonalInfo, savePersonalInfo } from '../../src/di/profile';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [firstName, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhone] = useState('');
  const defaultAvatar = require('../../assets/images/avatar_placeholder.png');

  const [isLoading, setIsLoading] = useState(true);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [newProfileImage, setNewProfileImage] = useState<any>(null);

  const normalizeImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (!path.startsWith('/')) path = `/${path}`;
    return `${API_URL}${path}`;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUserInfo = async () => {
      setIsLoading(true);
      try {
        const result = await loadPersonalInfo();
        if (result.status !== 'loaded' || !isMounted) return;

        setName(result.profile.firstName);
        setLastName(result.profile.lastName);
        setEmail(result.profile.email);
        setPhone(result.profile.phoneNumber);
        setProfilePicture(result.profile.profilePicture);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUserInfo();
    return () => { isMounted = false; };
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('personalInfo.error'), t('personalInfo.permissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setNewProfileImage(result.assets[0]);
    }
  };

  const handleDeleteImage = () => {
    Alert.alert(
      t('personalInfo.confirmDelete'),
      t('personalInfo.confirmDeleteMessage'),
      [
        { text: t('personalInfo.cancel'), style: 'cancel' },
        {
          text: t('personalInfo.delete'),
          style: 'destructive',
          onPress: () => {
            setNewProfileImage(null);
            setProfilePicture('');
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const imageChange = newProfileImage
        ? { kind: 'upload' as const, uri: newProfileImage.uri }
        : profilePicture === ''
          ? { kind: 'delete' as const }
          : { kind: 'keep' as const, profilePicture };

      const result = await savePersonalInfo(
        {
          firstName,
          lastName,
          email,
          phoneNumber,
          imageChange,
        },
        failure => {
          const error = failure.kind === 'missing-token'
            ? new Error(t('personalInfo.notLoggedIn'))
            : failure.error;
          console.error('Upload error:', error);
        },
      );

      if (result.status === 'missing-token') {
        Alert.alert(t('personalInfo.error'), t('personalInfo.notLoggedIn'));
        setIsLoading(false);
        return;
      }

      if (result.status === 'delete-missing-token') {
        throw new Error(t('personalInfo.notLoggedIn'));
      }

      if (result.status === 'delete-rejected') {
        throw new Error(result.responseText || t('personalInfo.deleteFailed'));
      }

      if (result.status === 'update-rejected') {
        throw new Error(
          (result.backendMessage as string) || t('personalInfo.updateFailed'),
        );
      }

      Alert.alert(t('personalInfo.success'), t('personalInfo.updated'));
      setNewProfileImage(null);
      setProfilePicture(result.profilePicture ?? '');
      router.push('../(tabs)/profile');
    } catch (error: any) {
      Alert.alert(t('personalInfo.error'), error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('../(tabs)/profile')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{t('personalInfo.title')}</Text>
        </View>
      </View>

      <View style={styles.imageContainer}>
        {profilePicture || newProfileImage ? (
          <Image
            source={
              newProfileImage
                ? { uri: newProfileImage.uri }
                : { uri: normalizeImageUrl(profilePicture!) }
            }
            style={styles.profileImage}
            onError={() => setProfilePicture('')}
          />
        ) : (
          <Image source={defaultAvatar} style={styles.profileImage} />
        )}

        <TouchableOpacity onPress={pickImage} style={styles.editButton}>
          <Ionicons name="pencil" size={24} color="#2563EB" />
        </TouchableOpacity>
        {(profilePicture || newProfileImage) && (
          <TouchableOpacity onPress={handleDeleteImage} style={styles.deleteButton}>
            <Ionicons name="trash" size={24} color="red" />
          </TouchableOpacity>
        )}

      </View>

      <Text style={styles.label}>{t('personalInfo.firstName')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.firstNamePlaceholder')}
        value={firstName}
        onChangeText={setName}
      />

      <Text style={styles.label}>{t('personalInfo.lastName')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.lastNamePlaceholder')}
        value={lastName}
        onChangeText={setLastName}
      />

      <Text style={styles.label}>{t('personalInfo.email')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('personalInfo.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>{t('personalInfo.phone')}</Text>
      <TextInput
        style={styles.input}
        value={phoneNumber}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>{t('personalInfo.saveChanges')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', padding: 20, paddingTop: 60, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backButton: { paddingRight: 10 },
  titleWrapper: { flex: 1, alignItems: 'center', marginRight: 34 },
  title: { fontSize: 22, fontWeight: '700' },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#2563EB',
    alignSelf: 'center',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
