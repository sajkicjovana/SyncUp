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
  Image,
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
import { AntDesign } from '@expo/vector-icons';
import { useFavorites } from '../context/FavoriteContext';

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

    return (
      <TouchableOpacity
        style={styles.eventItem}
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
      >
        <View style={{ position: 'relative' }}>
  {imageLoading[item.id] && (
    <ActivityIndicator
      size="small"
      color="#007AFF"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -12 }, { translateY: -12 }],
        zIndex: 1,
        width: 24,
        height: 24,
      }}
    />
  )}
  <Image
    source={{ uri: `${API_URL}/${item.imageUrl}` }}
    style={styles.eventImage}
    onLoadStart={() =>
      setImageLoading((prev) => ({ ...prev, [item.id]: true }))
    }
    onLoad={() =>
      setImageLoading((prev) => ({ ...prev, [item.id]: false }))
    }
    onError={() =>
      setImageLoading((prev) => ({ ...prev, [item.id]: false }))
    }
  />
</View>
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>{item.title || 'No title'}</Text>
          <Text style={styles.eventDate}>{formattedDate}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Text style={[styles.eventLocation, { marginRight: 8 }]}>
              {item.location || 'No location'}
            </Text>
            </View>
<Text style={styles.eventPrice}>
  {priceObj
    ? ( (!priceObj.minPrice && !priceObj.maxPrice) || (priceObj.minPrice === 0 && priceObj.maxPrice === 0) )
      ? t('freeEvent')
      : priceObj.minPrice === priceObj.maxPrice
        ? `${priceObj.minPrice} RSD`
        : `${priceObj.minPrice} - ${priceObj.maxPrice} RSD`
    : t('search.loadingPrice')}
</Text>


          
        </View>

        <TouchableOpacity
          style={styles.favoriteIcon}
          onPress={() => handleToggleFavorite(item.id)}
        >
          <AntDesign name="heart" size={24} color={isFavorite ? '#FF2D55' : '#ccc'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <Text style={styles.header}>{t('search.header')}</Text>

        <TextInput
          style={styles.searchInput}
          placeholder={t('search.placeholder')}
          placeholderTextColor="#9CA3AF" 
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

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
            <Ionicons name="calendar-outline" size={18} color="black" />
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
            <Ionicons name="calendar-outline" size={18} color="black" />
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
            <Text style={styles.clearButtonText}>{t('search.reset')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
        ) : events.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>{t('search.noResults')}</Text>
        ) : (
          <FlatList
            data={events}
            renderItem={renderEventItem}
            keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
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
    paddingHorizontal: 20,
    paddingTop: 50,
    backgroundColor: '#f0f4f8',
  },

  header: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 25,
    color: '#1a202c',
    letterSpacing: 1,
    textAlign: 'center',
  },

  searchInput: {
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 18,
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
    marginBottom: 12, // malo manje mesta dole nego pre
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },

  dropdown: {
    marginBottom: 12, // smanjen razmak dole
    borderRadius: 15,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },

  dropdownContainer: {
    borderRadius: 15,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },

  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12, // malo manji razmak
  },

  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 18,
    height: 48,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },

  dateButtonText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#4a5568',
    fontWeight: '600',
  },

  filterRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,  // manji razmak sa vrha
    marginBottom: 14, // manji razmak dole
    paddingHorizontal: 4,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  filterLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2d3748',
    marginRight: 12,
  },

  clearButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    shadowColor: '#ef4444',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 6,
  },

  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  eventItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 50, // povećan razmak između eventova i od dna
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'center',
  },

  eventImage: {
    width: 110,
    height: 110,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },

  eventContent: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: 'center',
  },

  eventTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1a202c',
  },

  eventDate: {
    marginTop: 6,
    fontSize: 14,
    color: '#718096',
    fontWeight: '600',
  },

  eventLocation: {
    marginTop: 6,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#4a5568',
  },

  eventPrice: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#2c7a7b',
  },

  favoriteIcon: {
    justifyContent: 'center',
    paddingLeft: 14,
  },
});

export default SearchScreen;
