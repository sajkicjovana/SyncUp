import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { favoritesUseCases } from '../../src/di/favorites';
import type { FavoriteEvent } from '../../src/domain/favorites';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { EventCard } from '../../components/EventCard';
import { theme } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
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

  const renderItem = ({ item }: { item: FavoriteEvent }) => {
    const dateTime = `${new Date(item.startDate).toLocaleDateString('sr-RS')} | ${
      new Date(item.startDate).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    }h`;

    return (
      <EventCard
        imageUri={`${API_URL}/${item.imageUrl}`}
        imageLoading={Boolean(imageLoading[item.id])}
        title={item.title}
        dateTime={dateTime}
        location={item.location}
        attendanceLabel={`${item.attendingCount === 0 ? '0' : `${item.attendingCount}+`} ${t('attending')}`}
        isFavorite
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
        onToggleFavorite={() => toggleFavorite(item.id)}
        favoriteAccessibilityLabel={t('removeFromFavorites')}
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
      <View style={[styles.container, { paddingTop: insets.top + 10, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10 }}>{t('loadingFavorites')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileOriginHeader: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.colors.textPrimary,
    marginRight: 44,
  },
  empty: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
  },
});
