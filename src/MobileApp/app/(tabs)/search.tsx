import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../config';
import { apiCall } from '../../config';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DropDownPicker from 'react-native-dropdown-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_URL as BASE_URL } from '../../config';
import { useFavorites } from '../context/FavoriteContext';
import { CompactEventCard } from '../../components/CompactEventCard';
import { theme } from '../../constants/theme';

import { searchUseCases } from '../../src/di/search';
import { readAuthToken } from '../../src/di/auth';
import { selectFreeSearchEvents } from '../../src/domain/search';
import type { SearchEvent as EventType, SearchPrices } from '../../src/domain/search';
import {
  captureSearchReturnState,
  clearSearchReturnState,
  consumeSearchReturnState,
  type SearchReturnSnapshot,
} from '../../src/presentation/search/searchReturnState';
const DETAILS_API_URL = `${BASE_URL}/api/Events/Details`;

interface LocationType {
  label: string;
  value: string;
}

const SearchScreen = () => {
  const router = useRouter();
  const { searchReturnKey: rawSearchReturnKey } = useLocalSearchParams<{
    searchReturnKey?: string | string[];
  }>();
  const searchReturnKey = Array.isArray(rawSearchReturnKey)
    ? rawSearchReturnKey[0]
    : rawSearchReturnKey;
  const restoredSnapshotRef = useRef<SearchReturnSnapshot | null | undefined>(undefined);
  if (restoredSnapshotRef.current === undefined) {
    restoredSnapshotRef.current = consumeSearchReturnState(searchReturnKey);
    if (!restoredSnapshotRef.current) clearSearchReturnState();
  }
  const restoredSnapshot = restoredSnapshotRef.current;
  const skipInitialSearchFetch = useRef(Boolean(restoredSnapshot));
  const skipInitialLocationsFetch = useRef(Boolean(restoredSnapshot));
  const { favorites, toggleFavorite } = useFavorites();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState(restoredSnapshot?.searchQuery ?? '');
  const [events, setEvents] = useState<EventType[]>(restoredSnapshot?.events ?? []);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>({});
  

  const [startDate, setStartDate] = useState<Date | null>(restoredSnapshot?.startDate ?? null);
  const [endDate, setEndDate] = useState<Date | null>(restoredSnapshot?.endDate ?? null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [isFree, setIsFree] = useState(restoredSnapshot?.isFree ?? false);
  
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    restoredSnapshot?.selectedCategory ?? null,
  );

    const categoryOptions = [
    { label: t('category.music'), value: 'Music' },
    { label: t('category.sports'), value: 'Sports' },
    { label: t('category.entertainment'), value: 'Entertainment' },
    { label: t('category.protest'), value: 'Protest' },
    { label: t('category.charity'), value: 'Charity' },
    { label: t('category.business'), value: 'Business' },
    { label: t('category.culture'), value: 'Culture' },
    { label: t('category.other'), value: 'Other' },
  ];



  const [locations, setLocations] = useState<LocationType[]>(restoredSnapshot?.locations ?? []);
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    restoredSnapshot?.selectedLocation ?? null,
  );

  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>(restoredSnapshot?.sortBy ?? 'popularity');


  // Mapa za cene: eventId -> { minPrice, maxPrice }
  const [eventPrices, setEventPrices] = useState<SearchPrices>(restoredSnapshot?.eventPrices ?? {});

  useEffect(() => {
    if (searchReturnKey) {
      consumeSearchReturnState(searchReturnKey);
      router.setParams({ searchReturnKey: undefined });
    }
  }, [router, searchReturnKey]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLocation(null);
    setStartDate(null);
    setEndDate(null);
    setIsFree(false);
    setSortBy('popularity');
    setSelectedCategory(null); 
  };
    const fetchLocations = async () => {
    try {
      const locationValues = await searchUseCases.loadLocations();
      const uniqueLocations = locationValues.map(loc => ({ label: loc, value: loc }));

      setLocations(uniqueLocations);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchEventDetailsPrice = async (eventId: number) => {
    try {
      const response = await apiCall(`${DETAILS_API_URL}?id=${eventId}`);
      if (!response.ok) throw new Error('Failed to fetch event details');
      const data = await response.json();
      setEventPrices(prev => ({
        ...prev,
        [eventId]: {
          minPrice: data.minPrice ?? null,
          maxPrice: data.maxPrice ?? null,
        },
      }));
    } catch (error) {
      console.error('Error fetching event details for price:', error);
    }
  };

const fetchEvents = useCallback(async () => {
  setLoading(true);
  try {
    let data = await searchUseCases.loadSearchEvents({
      searchQuery, selectedLocation, selectedCategory, startDate, endDate, sortBy,
    });

    // fetchuj cene za svaki event
    await Promise.all(
      data.map(async (event) => {
        const details = await searchUseCases.loadEventPrice(event.id);
        setEventPrices((prev) => ({
          ...prev,
          [event.id]: { minPrice: details.minPrice, maxPrice: details.maxPrice },
        }));
      })
    );

    // frontend filter za "Free only"
    if (isFree) {
      data = selectFreeSearchEvents(data, eventPrices);
    }

    setEvents(data);
  } catch (error) {
    console.error('Fetch error', error);
  } finally {
    setLoading(false);
  }
}, [searchQuery, selectedLocation, selectedCategory, startDate, endDate, isFree, sortBy]);


useEffect(() => {
  if (skipInitialSearchFetch.current) {
    skipInitialSearchFetch.current = false;
    return;
  }
  fetchEvents();
}, [fetchEvents]);

useEffect(() => {
  if (skipInitialLocationsFetch.current) {
    skipInitialLocationsFetch.current = false;
    return;
  }
  fetchLocations();
}, []);

  // OVDE je logika za proveru gosta i toggle favorite sa alertom
  const handleToggleFavorite = async (eventID: number) => {
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
    await toggleFavorite(eventID);
  };

  const renderEventItem = ({ item }: { item: EventType }) => {
    const isFavorite = favorites.includes(item.id);
    const date = item.startDate ? new Date(item.startDate) : null;
    const formattedDate = date && !isNaN(date.getTime()) ? date.toLocaleDateString('sr-RS') : 'No date';

    // uzmi cene iz eventPrices mape
    const priceObj = eventPrices[item.id];

    const priceLabel = priceObj
      ? ((!priceObj.minPrice && !priceObj.maxPrice) ||
        (priceObj.minPrice === 0 && priceObj.maxPrice === 0))
        ? t('freeEvent')
        : priceObj.minPrice === priceObj.maxPrice
          ? `${priceObj.minPrice} RSD`
          : `${priceObj.minPrice} - ${priceObj.maxPrice} RSD`
      : t('search.loadingPrice');

    return (
      <CompactEventCard
        imageUri={`${API_URL}/${item.imageUrl}`}
        imageLoading={Boolean(imageLoading[item.id])}
        title={item.title || 'No title'}
        date={formattedDate}
        location={item.location || 'No location'}
        priceLabel={priceLabel}
        isFavorite={isFavorite}
        onPress={() => {
          const searchReturnKey = captureSearchReturnState({
            searchQuery,
            selectedLocation,
            selectedCategory,
            startDate,
            endDate,
            isFree,
            sortBy,
            events,
            eventPrices,
            locations,
          });
          router.push({
            pathname: '/event/[id]',
            params: { id: String(item.id), from: 'search', searchReturnKey },
          });
        }}
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <Text style={styles.header}>{t('search.header')}</Text>

        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={19} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <DropDownPicker
          open={locationOpen}
          setOpen={setLocationOpen}
          value={selectedLocation}
          setValue={setSelectedLocation}
          items={locations}
          placeholder={t('search.selectLocation')}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          zIndex={3000}
          zIndexInverse={1000}
          multiple={false}
          searchable={true}
        />
        <DropDownPicker
          open={categoryOpen}
          setOpen={setCategoryOpen}
          value={selectedCategory}
          setValue={setSelectedCategory}
          items={categoryOptions}
          placeholder={t('search.selectCategory') || 'Select Category'}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          zIndex={2500}
          zIndexInverse={1500}
        />

        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateButton}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.primaryDark} />
            <Text style={styles.dateButtonText}>
              {startDate ? startDate.toDateString() : t('search.startDate')}
            </Text>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowStartPicker(false);
                if (date && event.type !== 'dismissed') {
                  setStartDate(date);
                }
              }}
            />

          )}

          <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateButton}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.primaryDark} />
            <Text style={styles.dateButtonText}>
              {endDate ? endDate.toDateString() : t('search.endDate')}
            </Text>
          </TouchableOpacity>
          {showEndPicker && (
           <DateTimePicker
              value={endDate || new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowEndPicker(false);
                if (date && event.type !== 'dismissed') {
                  setEndDate(date);
                }
              }}
            />

          )}
        </View>

        <DropDownPicker
          open={sortOpen}
          setOpen={setSortOpen}
          value={sortBy}
          setValue={setSortBy}
          items={[
            { label: t('search.dateAsc'), value: 'dateAsc' },
            { label: t('search.dateDesc'), value: 'dateDesc' },
            { label: t('search.priceAsc') || 'Price Ascending', value: 'priceAsc' },
            { label: t('search.priceDesc') || 'Price Descending', value: 'priceDesc' },
            { label: t('search.popularityDesc'), value: 'popularity' },
          ]}
          placeholder={t('search.sortBy')}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          zIndex={2000}
          zIndexInverse={2000}
          multiple={false}
        />

        <View style={styles.filterRowBottom}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t('search.freeOnly') || 'Free Only'}</Text>
            <Switch value={isFree} onValueChange={setIsFree} />
          </View>

          <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
            <Ionicons name="refresh-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.clearButtonText}>{t('search.reset')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
        ) : events.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>{t('search.noResults')}</Text>
        ) : (
          <FlatList
            data={events}
            renderItem={renderEventItem}
            keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
            ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            style={{ marginTop: 10 }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },

  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },

  dropdown: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.control,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: 46,
  },

  dropdownContainer: {
    borderRadius: theme.radii.control,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },

  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    height: 46,
    marginHorizontal: 4,
  },

  dateButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  filterRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.sm,
  },

  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  clearButtonText: {
    color: theme.colors.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },

  resultSeparator: {
    height: 12,
  },

});

export default SearchScreen;
