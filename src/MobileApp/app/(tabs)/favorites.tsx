import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { favoritesUseCases } from '../../src/di/favorites';
import type { FavoriteEvent } from '../../src/domain/favorites';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ParamListBase } from '@react-navigation/native';
import { useFavorites } from '../context/FavoriteContext';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function FavoritesScreen() {
  const { favorites, toggleFavorite } = useFavorites();
  const [events, setEvents] = useState<FavoriteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>({});
  const router = useRouter();
  const tabNavigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const { t } = useTranslation();

  useEffect(
    () =>
      tabNavigation.addListener('tabPress', () => {
        if (from === 'profile') tabNavigation.setParams({ from: undefined });
      }),
    [from, tabNavigation]
  );

  const returnToProfile = useCallback(() => {
    tabNavigation.setParams({ from: undefined });
    router.navigate('/(tabs)/profile');
  }, [router, tabNavigation]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || from !== 'profile') return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        returnToProfile();
        return true;
      });

      return () => subscription.remove();
    }, [from, returnToProfile])
  );

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setLoading(true);
      const token = await favoritesUseCases.readToken();

      if (!token) {
        setIsGuest(true);
        setLoading(false);
        return;
      }

      setIsGuest(false);

      try {
        const response = await favoritesUseCases.loadFavoriteEvents(token);

        if (response.ok) {
          setEvents(response.events);
        } else {
          console.error('Failed to fetch favorite events:', response.status);
        }
      } catch (err) {
        console.error('Error fetching favorite events:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [favorites]);

  const renderItem = ({ item }: { item: FavoriteEvent }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '../event/[id]',
          params: {
            id: item.id,
            from: 'favorites',
            ...(from === 'profile' ? { favoritesFrom: 'profile' } : {}),
          },
        })
      }
    >
      <View style={styles.imageWrapper}>
        {imageLoading[item.id] && (
          <ActivityIndicator size="large" color="#007AFF" style={StyleSheet.absoluteFill} />
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
        🕒{' '}
        {new Date(item.startDate).toLocaleDateString('en-US')} |{' '}
        {new Date(item.startDate).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
        h
      </Text>
      <Text style={styles.info}>📍 {item.location}</Text>

      <View style={styles.row}>
        <Text style={styles.attending}>
          {item.attendingCount === 0 ? '0' : `${item.attendingCount}+`} {t('attending')}
        </Text>
        <TouchableOpacity onPress={() => toggleFavorite(item.id)}>
          <AntDesign name="heart" size={20} color="#FF2D55" />
        </TouchableOpacity>
      </View>

    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>{t('loadingFavorites')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {from === 'profile' ? (
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={returnToProfile}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name='arrow-back' size={28} color='black' />
          </TouchableOpacity>
          <Text style={styles.profileOriginHeader}>{t('yourFavorites')}</Text>
        </View>
      ) : (
        <Text style={styles.header}>{t('yourFavorites')}</Text>
      )}
      {isGuest ? (
        <Text style={styles.empty}>{t('mustBeLoggedInToViewFavorites')}</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>{t('noFavoriteEvents')}</Text>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 12,
    padding: 6,
    borderRadius: 8,
  },
  profileOriginHeader: {
    flex: 1,
    marginRight: 40,
    fontSize: 24,
    fontWeight: '900',
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
});
