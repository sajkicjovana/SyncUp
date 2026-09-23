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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { loadPersonalInfo, savePersonalInfo } from '../../src/di/profile';
import { theme } from '../../constants/theme';

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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('../(tabs)/profile')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
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
          <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      {(profilePicture || newProfileImage) && (
        <TouchableOpacity onPress={handleDeleteImage} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={16} color="#C53030" />
          <Text style={styles.deleteText}>{t('personalInfo.delete')}</Text>
        </TouchableOpacity>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    paddingVertical: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    marginRight: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
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
    borderColor: theme.colors.primary,
    alignSelf: 'center',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.round,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    shadowColor: theme.shadow.color,
    shadowOffset: theme.shadow.offset,
    shadowOpacity: theme.shadow.opacity,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  deleteText: {
    color: '#C53030',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.control,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
