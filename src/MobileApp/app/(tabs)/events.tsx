import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { loadEvents } from '../../src/di/eventList';
import type { EventListItem } from '../../src/domain/eventList';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFavorites } from '../context/FavoriteContext';
import { useTranslation } from 'react-i18next';
import { readAuthToken } from '../../src/di/auth';
import { EventCard } from '../../components/EventCard';
import { theme } from '../../constants/theme';

export default function EventsScreen() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>({});
  const router = useRouter();
  const { favorites, toggleFavorite, clearFavorites } = useFavorites();
  const { t } = useTranslation();

  useEffect(() => {
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const result = await loadEvents();
      if (result.status === 'loaded') {
        setEvents(result.events);
      } else if (result.status === 'request-failed') {
        console.error("Failed to fetch events:", result.statusCode);
      } else {
        console.error("Error fetching events:", result.error);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchEvents();
}, []);


  const handleToggleFavorite = async (eventId: number) => {
    const token = await readAuthToken();
    if (!token) {
      Alert.alert(
        t('notLoggedIn'),
        t('loginToAddFavorites'),
        [
          { text: t('continueAsGuest') },
          {
            text: t('logIn'),
            onPress: () => router.push('/login'),
          },
        ],
        { cancelable: true }
      );
      return;
    }
    await toggleFavorite(eventId);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    clearFavorites();
    Alert.alert(t('loggedOut'), t('youHaveBeenLoggedOut'));
    router.replace('/login');
  };

  const renderItem = ({ item }: { item: EventListItem }) => {
    const isFavorite = favorites.includes(item.id);

    const dateTime = `${new Date(item.startDate).toLocaleDateString('sr-RS')} | ${
      new Date(item.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }h`;

    return (
      <EventCard
        imageUri={`${API_URL}/${item.imageUrl}`}
        imageLoading={Boolean(imageLoading[item.id])}
        title={item.title}
        dateTime={dateTime}
        location={item.location}
        isFavorite={isFavorite}
        onPress={() => router.push({ pathname: '../event/[id]', params: { id: item.id, from: 'events' } })}
        onToggleFavorite={() => handleToggleFavorite(item.id)}
        favoriteAccessibilityLabel={
          isFavorite ? t('removeFromFavorites') : t('addToFavorites')
        }
        onImageLoadStart={() =>
          setImageLoading((prev) => ({ ...prev, [item.id]: true }))
        }
        onImageLoadEnd={() =>
          setImageLoading((prev) => ({ ...prev, [item.id]: false }))
        }
      />
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10 }}>{t('loadingEvents')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('events')}</Text>
      {events.length === 0 ? (
        <Text style={styles.empty}>{t('noEvents')}</Text>
      ) : (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  empty: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
  },
});
