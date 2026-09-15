import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { loadEvents } from '../../src/di/eventList';
import type { EventListItem } from '../../src/domain/eventList';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign } from '@expo/vector-icons';
import { useFavorites } from '../context/FavoriteContext';
import { useTranslation } from 'react-i18next';

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
    const token = await AsyncStorage.getItem('token');
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

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '../event/[id]', params: { id: item.id, from: 'events' } })}
      >
        <View style={styles.imageWrapper}>
          {imageLoading[item.id] && (
            <ActivityIndicator
              size="large"
              color="#007AFF"
              style={StyleSheet.absoluteFill}
            />
          )}
          <Image
            source={{ uri: `${API_URL}/${item.imageUrl}` }}
            style={styles.image}
            onLoadStart={() =>
              setImageLoading((prev) => ({ ...prev, [item.id]: true }))
            }
            onLoadEnd={() =>
              setImageLoading((prev) => ({ ...prev, [item.id]: false }))
            }
          />
        </View>

        <Text style={styles.title}>{item.title}</Text>

        <Text style={styles.info}>
          🕒 {new Date(item.startDate).toLocaleDateString('sr-RS')} |{' '}
          {new Date(item.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}h
        </Text>
        <View style={styles.row}>
          <View style={styles.locationWrapper}>
            <Text style={styles.info} numberOfLines={2}>📍 {item.location}</Text>
          </View>
          <TouchableOpacity onPress={() => handleToggleFavorite(item.id)}>
            <AntDesign name="heart" size={20} color={isFavorite ? '#FF2D55' : '#ccc'} />
          </TouchableOpacity>
        </View>

      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
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
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1a202c',
  },
  empty: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 60,
  },
  card: {
    backgroundColor: '#fefefe',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  imageWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  info: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  row: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attending: {
    fontSize: 12,
    backgroundColor: '#c084fc',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    color: '#fff',
    fontWeight: '700',
    overflow: 'hidden',
  },
  locationWrapper: {
    flex: 1,
    paddingRight: 8,
  },
});
