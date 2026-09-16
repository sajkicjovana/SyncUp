import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { API_URL } from '../../config';
import { MaterialIcons } from '@expo/vector-icons';
import { apiCall } from '../../config';
import { WebView } from 'react-native-webview';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFavorites } from '../context/FavoriteContext';
import { useTranslation } from 'react-i18next';
import { loadEventAgenda } from '../../src/di/eventAgenda';
import { loadEventDetails } from '../../src/di/eventDetails';
import type { EventAgendaResponse } from '../../src/domain/eventAgenda';
import type { EventDetails } from '../../src/domain/eventDetails';


const screen = Dimensions.get('window');


type AgendaItem = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
};

type PinCategory = {
  id: number;
  name: string;
};

type Event = EventDetails & { agenda?: AgendaItem[]; isFree: boolean };

type EventPin = {
  id: number;
  eventId: number;
  latitude: number;
  longitude: number;
  label: string;
  description: string;
  pinnedAt: string;
  pinCategory: number;
};
function buildLeafletHtml(payload: {
  center: { latitude: number; longitude: number };
  pins: { lat: number; lng: number; title: string; desc: string; iconUrl?: string; emoji?: string }[];
  zones: any[];
  mapType: 'standard' | 'satellite';
}) {
  const safeJson = JSON.stringify(payload).replace(/<\/(script)/gi, '<\\/$1');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  .leaflet-container { background: #dfe5f3; }
  .emojiMarker { border: 0; background: transparent; }
  .emojiMarker .em { font-size: 22px; line-height: 22px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  const DATA = ${safeJson};
  const center = [DATA.center.latitude, DATA.center.longitude];
  const isSat = DATA.mapType === 'satellite';

  var map = L.map('map', { zoomControl: false });
  var osm  = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });
  var esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });

  (isSat ? esri : osm).addTo(map);

  var bounds = L.latLngBounds([]);

  // Pins
  (DATA.pins || []).forEach(function(p){
    var icon = p.iconUrl
      ? L.icon({ iconUrl: p.iconUrl, iconSize:[30,30], iconAnchor:[15,15] })
      : L.divIcon({ className:'emojiMarker', html:'<div class="em">'+(p.emoji||'📍')+'</div>', iconSize:[24,24], iconAnchor:[12,12] });

    var m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    if (p.title || p.desc) m.bindPopup('<b>'+ (p.title||'') +'</b>' + (p.desc ? '<br/>'+p.desc : ''));
    bounds.extend([p.lat, p.lng]);
  });

  // Zones (trenutno prazno)
  (DATA.zones || []).forEach(function(z){
    if(!z.coords) return;
    var coords = z.coords.map(c => [c[0], c[1]]);
    var poly = L.polygon(coords, { color: z.stroke || '#2196f3', fillColor: z.fill || z.stroke || '#2196f3', fillOpacity:0.25 }).addTo(map);
    if(z.desc) poly.bindPopup(z.desc);
    try { bounds.extend(poly.getBounds()); } catch(e){}
  });

  if(bounds.isValid()) map.fitBounds(bounds, { padding: [20,20] });
  else map.setView(center, 15);

  L.control.zoom({ position:'topright' }).addTo(map);
})();
</script>
</body>
</html>`;
}


export default function EventDetailScreen() {
  const { id, from } = useLocalSearchParams();
  const router = useRouter();
  const { i18n, t } = useTranslation();

  const tabDestination = from === 'favorites' ? '/(tabs)/favorites'
    : from === 'search' ? '/(tabs)/search'
    : from === 'events' ? '/(tabs)/events'
    : null;

  const returnToOriginTab = useCallback(() => {
    if (!tabDestination) return false;
    router.dismissTo(tabDestination);
    return true;
  }, [router, tabDestination]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !tabDestination) return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', returnToOriginTab);

      return () => subscription.remove();
    }, [returnToOriginTab, tabDestination])
  );


  const currentId = typeof id === 'string' ? id : '';

  const [event, setEvent] = useState<Event | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eventPins, setEventPins] = useState<EventPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFavorite, setUpdatingFavorite] = useState(false);
  const [pinCategories, setPinCategories] = useState<PinCategory[]>([]);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const { loadFavorites } = useFavorites();
  const [openSubeventId, setOpenSubeventId] = useState<string | null>(null);
  const handleToggleSubevent = (id: string) => {
    if (openSubeventId === id) {
      setOpenSubeventId(null);
    } else {
      setOpenSubeventId(id);
    }
  };
//   const handleOpenSubeventDetail = (id: string) => {
//   router.push(`/event/${id}`);
// };



  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);


  
const [agendaData, setAgendaData] = useState<EventAgendaResponse | null>(null);
  
 useEffect(() => {
  const fetchEvent = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');

      const data = await loadEventDetails(currentId, token);

      const isFreeCalculated =
        (data.minPrice === null || data.minPrice === 0) &&
        (data.maxPrice === null || data.maxPrice === 0);

      setEvent({ ...data, isFree: isFreeCalculated });

      geocodeLocation(data.location);
      fetchEventPins(data.id);

      const fetchCategories = async () => {
        try {
          const response = await apiCall(`${API_URL}/api/EventPin/categories`);
          if (!response.ok) throw new Error('Failed to load categories');
          const data: PinCategory[] = await response.json();
          setPinCategories(data);
        } catch (err) {
          console.error('Greška pri učitavanju kategorija:', err);
        }
      };
      fetchCategories();

    } catch (err) {
      console.error(err);
      setError(t('failedToLoadEventDetails'));
    } finally {
      setLoading(false);
    }
  };

  fetchEvent();
}, [currentId]);
// useEffect(() => {
//   if (!event) return;

//   const fetchMainEventPins = async () => {
//     try {
//       const response = await fetch(`${API_URL}/pins/by-events?ids=${event.id}`);
//       if (!response.ok) throw new Error('Failed to fetch pins');

//       const data: EventPin[] = await response.json();

//       // ukloni duplikate po ID-u
//       const uniquePins = data.filter((pin, index, self) =>
//         index === self.findIndex(p => p.id === pin.id)
//       );

//       setEventPins(uniquePins);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   fetchMainEventPins();
// }, [event]);

useEffect(() => {
  if (!event) return;

  const fetchResources = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setHasResources(false);
        return;
      }
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await apiCall(`${API_URL}/api/Resource/${event.id}/resources`, { headers });
      if (!response.ok) throw new Error('Failed to load resources');

      const data = await response.json();
      setHasResources(data.length > 0);
    } catch (err) {
      console.error(err);
      setHasResources(false);
    }
  };

  fetchResources();
}, [event]);
useEffect(() => {
  if (!agendaData) return;


}, [agendaData]);


useEffect(() => {
  if (!currentId) return;

  const fetchAgenda = async () => {
    setAgendaLoading(true);
    setAgendaError(null);

    try {
      const token = await AsyncStorage.getItem('token');

      const data = await loadEventAgenda(currentId, token);
      setAgendaData(data);
    } catch (err) {
      console.error(err);
      setAgendaError(t('failedToLoadAgenda'));
    } finally {
      setAgendaLoading(false);
    }
  };

  fetchAgenda();
}, [currentId]);
const [hasResources, setHasResources] = useState<boolean | null>(null);

useEffect(() => {
  if (!currentId) return;

  const fetchResources = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setHasResources(false);
        return;
      }

      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await apiCall(`${API_URL}/api/Resource/${currentId}/resources`, { headers });
      if (!response.ok) throw new Error('Failed to load resources');

      const data = await response.json();
      setHasResources(data.length > 0);
    } catch (err) {
      console.error(err);
      setHasResources(false);
    }
  };

  fetchResources();
}, [currentId]);


  const combinedSortedAgendaItems = () => {
  if (!agendaData) return [];

  const events = agendaData.eventsAndSubevents.map((e) => ({
    id: `event-${e.eventId}`,
    type: 'event' as const,
    title: e.title,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
  }));

  const activities = agendaData.activities.map((a) => ({
    id: `activity-${a.activityId}`,
    type: 'activity' as const,
    title: a.title,
    description: a.description,
    startDate: a.startDate,
    endDate: a.endDate,
  }));

  const combined = [...events, ...activities];
  combined.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return combined;
};

const checkUserProfile = async () => {
  try {
    const token = await AsyncStorage.getItem('token');

    if (!token) {
  Alert.alert(
    t('auth.notLoggedInTitle'),     
    t('auth.notLoggedInMessage'),    
    [
      {
        text: t('auth.login'),   
        onPress: () => router.push('/login'),
      },
      {
        text: t('auth.cancel'),    
        style: 'cancel',
      },
    ]
  );
  return false;
}


    const response = await apiCall(`${API_URL}/api/MobileUser/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Greška prilikom učitavanja profila');
    }

    const user = await response.json();
    const { firstName, lastName, email } = user;

    if (!firstName || !lastName || !email) {
      Alert.alert(
        t('profileCheck.incompleteTitle'),
        t('profileCheck.incompleteMessage'),

        [
          {
             text: t('profileCheck.fillProfile'),
            onPress: () => router.push('../profile/personal-info'),
          },
        ]
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(err);
    Alert.alert(t('profileCheck.errorTitle'), t('profileCheck.errorMessage'));
    return false;
  }
};




const handleAction = async () => {
  // free + bez resursa → dugme je disabled i ne treba da pozove ništa
  if (event?.isFree && !hasResources) return;

  // u svim ostalim slučajevima proveravamo user profil
  const isProfileComplete = await checkUserProfile();
  if (!isProfileComplete) return;

  // ako nije free → vodi na tickets
  if (event && !event.isFree) {
    router.push({ pathname: './tickets', params: { eventId: event.id.toString() } });
  } 
  // free + ima resurse → vodi na tickets
  else if (event?.isFree && hasResources) {
    router.push({ pathname: './tickets', params: { eventId: event.id.toString() } });
  }
};




    const fetchEventPins = async (eventId: number) => {
  try {
    // Za guest ne zahtevamo token
    const token = await AsyncStorage.getItem('token');

    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Ispravan endpoint
    const response = await apiCall(`${API_URL}/api/EventPin/event/?eventId=${eventId}`, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Ne mogu da učitam pinove:', errorText);
      setEventPins([]); // fallback
      return;
    }

    const data: EventPin[] = await response.json();

    // Spoj sa kategorijama za ikonice
    const pinsWithCategory = data.map((pin) => {
      const category = pinCategories.find((c) => c.id === pin.pinCategory);
      return {
        ...pin,
        iconUrl: category ? `${API_URL}/pins/${category.id}.png` : undefined,
        emoji: '📍', // fallback emoji
        title: pin.label + (category ? ` (${category.name})` : ''),
      };
    });

    setEventPins(pinsWithCategory);
  } catch (err) {
    console.warn('Greška pri učitavanju pinova:', err);
    setEventPins([]);
  }
};



  const geocodeLocation = async (location: string) => {
    try {
      const response = await apiCall(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
        {
          headers: {
            'User-Agent': 'SyncUpApp/1.0 (support@syncupapp.com)',
            'Accept-Language': 'en',
          },
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      if (data && data.length > 0) {
        setCoords({
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        });
      }
    } catch (err) {
      console.warn('Error geocoding location:', err);
    }
  };

  const toggleFavorite = async () => {
    if (!event) return;

    setUpdatingFavorite(true);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert(
          t('authenticationRequired'),
          t('loginToManageFavorites'),
          [
            { text: t('cancel'), style: 'cancel' },
            { text: t('login'), onPress: () => router.push('/login') },
          ]
        );
        setUpdatingFavorite(false);
        return;
      }

      const method = event.isFavorite ? 'DELETE' : 'POST';

      const res = await apiCall(`${API_URL}/api/Favorites`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event.id),
      });

      if (res.ok) {
        setEvent((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : prev));
        await loadFavorites();
      } else {
        const errorText = await res.text();
        Alert.alert(t('error'), `${t('failedToUpdateFavorite')}: ${errorText}`);
      }
    } catch (err) {
      Alert.alert(t('error'), t('failedToUpdateFavorite'));
    } finally {
      setUpdatingFavorite(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 16 }}>{error || t('eventNotFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
  onPress={() => {
    if (returnToOriginTab()) return;
    if (from === 'reservationDetails') router.back();
    else if (from === 'ticketDetails') router.back(); // dodato
    else router.replace('/events');
  }}
  style={styles.backButton}
>
  <Ionicons name="arrow-back" size={24} color="#333" />
</TouchableOpacity>



      <Text style={styles.naslov}>{t('aboutEvent')}</Text>

      <View style={styles.imageWrapper}>
        {imageLoading && (
          <ActivityIndicator size="large" color="#2563EB" style={StyleSheet.absoluteFill} />
        )}
        <Image
          source={{ uri: `${API_URL}/${event.imageUrl}` }}
          style={styles.image}
          onLoadEnd={() => setImageLoading(false)}
        />
      </View>

      <Text style={styles.title}>{event.title}</Text>
   <Text style={styles.date}>
      📅{' '}
      {new Date(event.startDate).toLocaleDateString(
        i18n.language === 'sr' ? 'sr-Latn' : i18n.language,
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }
      )}
    </Text>

      <View style={styles.infoCard}>
        <Text style={styles.info}>
          🕒 {t('time')}: {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}h -{' '}
          {new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}h
        </Text>
        <Text style={styles.info}>📍 {t('location')}: {event.location}</Text>
        <Text style={styles.info}>🏢 {t('organizer')}: {event.organizerName}</Text>
        {!event.isFree && event.minPrice != null && event.maxPrice != null && (
          <Text style={styles.info}>
            💸 {t('price')}: {event.minPrice === event.maxPrice ? `${event.minPrice} RSD` : `${event.minPrice} - ${event.maxPrice} RSD`}
          </Text>
        )}
      </View>

   <View style={styles.actions}>
  {/* Favorite dugme */}
  <TouchableOpacity
    style={styles.favoriteBtn}
    onPress={toggleFavorite}
    activeOpacity={0.7}
    disabled={updatingFavorite}
  >
    <Ionicons
      name={event.isFavorite ? 'heart' : 'heart-outline'}
      size={24}
      color={event.isFavorite ? '#FF2D55' : '#2563EB'}
    />
    <Text style={[styles.favoriteText, { color: event.isFavorite ? '#FF2D55' : '#2563EB' }]}>
      {event.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
    </Text>
  </TouchableOpacity>

  {/* Dugme za kupovinu / rezervaciju */}
<TouchableOpacity
  onPress={handleAction}
  style={[
    styles.buyButton,
    event?.isFree && !hasResources ? { backgroundColor: '#d1d5db' } : {},
  ]}
  disabled={event?.isFree && !hasResources}
>
  <Text style={styles.buyButtonText}>
    {!event?.isFree
      ? t('buyTicket')        
      : hasResources
      ? t('freeResources')        
      : t('freeEvent')}       
  </Text>
</TouchableOpacity>






</View>

      <Text style={styles.sectionTitle}>{t('eventDescription')}</Text>
      <Text style={styles.description}>{event.description}</Text>
{!agendaLoading && !agendaError && agendaData && (
  <>
    <Text style={styles.sectionTitle}>{t('agenda')}</Text>

    {combinedSortedAgendaItems().map((item) => {
      if (item.type === 'event') {
        const subeventId = parseInt(item.id.replace('event-', ''));
        const isSubevent = agendaData.eventsAndSubevents.some(
          (e) => e.eventId === subeventId && e.parentEventId !== 0
        );

        return (
          <View key={item.id} style={styles.scheduleItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => handleToggleSubevent(item.id)} style={{ flex: 1 }}>
                <Text style={[
                  styles.scheduleTime,
                  { fontWeight: isSubevent ? '800' : '700', fontSize: isSubevent ? 16 : 14 }
                ]}>
                  {new Date(item.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(item.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={[
                  styles.scheduleTitle,
                  { fontWeight: isSubevent ? '800' : '700', fontSize: isSubevent ? 18 : 16 }
                ]}>
                  {item.title}
                </Text>
              </TouchableOpacity>

              {/* Lupica za otvaranje detalja poddogađaja
              {isSubevent && (
                <TouchableOpacity
                  onPress={() => handleOpenSubeventDetail(subeventId.toString())}
                  style={{ paddingHorizontal: 8 }}
                >
                  <Ionicons name="search-outline" size={24} color="#2563EB" />
                </TouchableOpacity>
              )} */}
            </View>

            {/* Padajući meni aktivnosti poddogađaja */}
            {isSubevent && openSubeventId === item.id && (
              <View style={{ marginTop: 8, paddingLeft: 16 }}>
                {agendaData.activities
                  .filter((a) => a.eventId === subeventId)
                  .map((activity) => (
                    <View key={`activity-${activity.activityId}`} style={styles.scheduleItem}>
                      <Text style={styles.scheduleTime}>
                        {new Date(activity.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(activity.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={[styles.scheduleTitle, { fontWeight: '500' }]}>
                        {activity.title}
                      </Text>
                      <Text style={styles.scheduleDesc}>{activity.description}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        );
      } else {
        return null; // aktivnosti su već prikazane unutar poddogađaja ili kasnije
      }
    })}

    {/* Aktivnosti koje nisu vezane ni za jedan poddogađaj */}
    {agendaData.activities
      .filter((activity) => {
        return !agendaData.eventsAndSubevents.some(
          (e) => e.eventId === activity.eventId && e.parentEventId !== 0
        );
      })
      .map((activity) => (
        <View key={`activity-${activity.activityId}`} style={styles.scheduleItem}>
          <Text style={styles.scheduleTime}>
            {new Date(activity.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
            {new Date(activity.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={[styles.scheduleTitle, { fontWeight: '500' }]}>
            {activity.title}
          </Text>
          <Text style={styles.scheduleDesc}>{activity.description}</Text>
        </View>
      ))}
  </>
)}

{coords && (
  <>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 }}>
  <Text style={styles.sectionTitle}>{t('location')}</Text>

  <TouchableOpacity
    onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563EB',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    }}
  >
    <MaterialIcons
      name={mapType === 'standard' ? 'satellite' : 'map'}
      size={20}
      color="#fff"
      style={{ marginRight: 6 }}
    />
    <Text style={{ color: '#fff', fontWeight: '600' }}>
      {mapType === 'standard' ? t('satelliteView') : t('standardView')}
    </Text>
  </TouchableOpacity>
</View>



{/* ---------------- MAPA ---------------- */}
{coords && (
  <>
    <View style={styles.mapWrapper}>
      <WebView
        originWhitelist={['*']}
        style={{ flex: 1 }}
        source={{
          html: buildLeafletHtml({
            center: coords,
            pins: eventPins.map((pin) => {
              const category = pinCategories.find((c) => c.id === pin.pinCategory);
              return {
                lat: pin.latitude,
                lng: pin.longitude,
                emoji: '📍',
                title: pin.label + (category ? ` (${category.name})` : ''),
                desc: pin.description,
                iconUrl: `${API_URL}/pins/${pin.pinCategory}.png`,
              };
            }),
            zones: [],
            mapType,
          }),
        }}
        javaScriptEnabled
        domStorageEnabled
        automaticallyAdjustContentInsets={false}
        scrollEnabled={false}
      />
    </View>

    {/* ---------------- LEGENDA ---------------- */}
    <View style={styles.legendWrapper}>
      <Text style={styles.legendTitle}>📍 {t('Legend')}</Text>
      {Array.from(new Set(eventPins.map((pin) => pin.pinCategory))).map((catId) => {
      const category = pinCategories.find((c) => c.id === catId);
      return (
        <View key={catId} style={styles.legendItem}>
          <Image
            source={{ uri: `${API_URL}/pins/${catId}.png` }}
            style={styles.legendIcon}
            resizeMode="contain"
          />
          <Text style={styles.legendText}>
            {category?.name ? t(`map.pins.${category.name}`) : t('map.pins.Unknown')}
          </Text>

        </View>
      );
    })}
    </View>
  </>
)}     
  </>
)}



  
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    marginBottom:30
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
    marginTop: 40,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: '#e5e7eb',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  naslov:{
    fontSize: 26,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
    textAlign:'center'
  },
  date: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#edeff1ff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  info: {
    fontSize: 15,
    marginBottom: 6,
    color: '#374151',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  favoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteText: {
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  buyBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  buyBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  buyText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 28,
    color: '#111827',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
  },
  scheduleItem: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  scheduleTime: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
    color: '#1f2937',
  },
  scheduleTitle: {
    fontSize: 14,
    color: '#111827',
  },
  scheduleDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  map: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginBottom: -10,
    paddingTop:30
  },
  backText: {
    fontSize: 16,
    color: '#111827',
  },
  buyButton: {
  backgroundColor: '#007AFF',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 8,
  alignItems: 'center',
},
buyButtonText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
},
  mapWrapper: {
    width: '100%',
    height: screen.height * 0.35,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#dfe5f3',
    marginTop: 10,
  },
  legendWrapper: {
    marginTop: 20,
    marginBottom: 40, // veći bottom padding da se ne seče
    paddingHorizontal: 10,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111827',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#374151',
  },

});
