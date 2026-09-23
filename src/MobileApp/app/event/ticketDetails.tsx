import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../../config';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { loadPersonalInfo } from '../../src/di/profile';

type TicketType = {
  id: number;
  name: string;
  quantity: number;
};

export default function TicketDetails() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ticketIDs, validationTokens, eventName, eventID, purchasedAt, ticketTypes, from } = useLocalSearchParams();


  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRefs = useRef<Array<any>>([]);

  // Parsiranje ID-eva karata
  let ids: number[] = [];
  try {
    if (ticketIDs) ids = JSON.parse(ticketIDs as string);
  } catch (error) {
    console.error('Invalid ticketIDs param', error);
  }

  // Parsiranje tokena
  let tokens: string[] = [];
  try {
    if (validationTokens) tokens = JSON.parse(validationTokens as string);
  } catch (error) {
    console.error('Invalid validationTokens param', error);
  }

  // Parsiranje tipova karata
  let parsedTicketTypes: TicketType[] = [];
  try {
    if (ticketTypes) parsedTicketTypes = JSON.parse(ticketTypes as string);
  } catch (error) {
    console.error('Invalid ticketTypes param', error);
  }

 // Parsiramo purchasedAt niz
   let purchasedDates: string[] = [];
if (purchasedAt) {
  try {
    purchasedDates = JSON.parse(purchasedAt as string);
  } catch {
    purchasedDates = [purchasedAt as string]; // fallback za jedan datum
  }
}



  // Funkcija za pronalazenje imena tipa karte
  const getTicketTypeName = (id: number): string => {
    const ticketType = parsedTicketTypes.find(t => t.id === id);
    return ticketType ? ticketType.name : t('ticketDetails.unknownTicket');
  };

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const result = await loadPersonalInfo();
        if (result.status === 'missing-token') {
          setLoading(false);
          return;
        }

        if (result.status === 'non-ok') throw new Error('Failed to fetch user');
        setFullName(`${result.profile.firstName} ${result.profile.lastName}`);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Download QR kao PNG
  const downloadQR = async (index: number) => {
    try {
      const ref = svgRefs.current[index];
      if (!ref) return;

      const svgData = await new Promise<string>((resolve) =>
        ref.toDataURL((data: string) => resolve(data))
      );

      const filename = FileSystem.documentDirectory + `ticket-${index + 1}.png`;
      await FileSystem.writeAsStringAsync(filename, svgData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert(t('qr.savedTitle'), t('qr.savedMessage', { filename }));
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(t('qr.errorTitle'), t('qr.saveError'));
    }
  };

  // Share QR
  const shareQR = async (index: number) => {
    try {
      const ref = svgRefs.current[index];
      if (!ref) return;

      const svgData = await new Promise<string>((resolve) =>
        ref.toDataURL((data: string) => resolve(data))
      );

      const fileUri = FileSystem.cacheDirectory + `ticket-${index + 1}.png`;
      await FileSystem.writeAsStringAsync(fileUri, svgData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('qr.shareNotAvailableTitle'), t('qr.shareNotAvailable'));
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert(t('qr.errorTitle'), t('qr.shareError'));
    }
  };

  const displayEventName =
    typeof eventName === 'string' && eventName.trim() !== ''
      ? eventName
      : t('ticketDetails.viewEventDetails');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0047FF" />
        <Text style={{ marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>🎟️ {t('ticketDetails.title')}</Text>

      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: `../event/${eventID}`,
            params: { from: 'ticketDetails' },
          })
        }
      >
        <Text style={styles.eventName}>{displayEventName}</Text>
      </TouchableOpacity>



      <Text style={[styles.detail, { marginBottom: 16 }]}>
        {t('ticketDetails.purchasedBy')}:{' '}
        <Text style={{ fontWeight: '600' }}>
          {fullName ?? t('ticketDetails.unknownUser')}
        </Text>
      </Text>

      {/* QR kodovi */}
    {ids.map((id, index) => {
      const token = tokens[index];
      const purchaseDate = purchasedDates[index]
        ? new Date(purchasedDates[index]).toLocaleString()
        : t('ticketDetails.unknownDate');



      return (
        <View key={index} style={styles.ticketCard}>
          <Text style={styles.ticketLabel}>
            🎫 {t('ticketDetails.ticket')} #{index + 1}
          </Text>

          {token ? (
            <QRCode
              value={`${API_URL}/api/TicketValidation/validate/${id}/${token}`}
              size={250}
              backgroundColor="white"
              color="black"
              getRef={(ref) => (svgRefs.current[index] = ref)}
            />
          ) : (
            <Text style={styles.errorText}>{t('ticketDetails.qrError')}</Text>
          )}

          <View style={styles.cardDetails}>
            <Text style={styles.detail}>
              {t('ticketDetails.purchasedAt')}: {purchaseDate}
            </Text>
            {!loading && (
              <Text style={styles.detail}>
                {t('ticketDetails.purchasedBy')}: <Text style={{ fontWeight: '600' }}>{fullName ?? t('ticketDetails.unknownUser')}</Text>
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => downloadQR(index)} style={styles.button}>
              <Text style={styles.buttonText}>📥 {t('buttons.download')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => shareQR(index)} style={styles.buttonSecondary}>
              <Text style={styles.buttonText}>📤 {t('buttons.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    })}


      <TouchableOpacity
        style={styles.backToEventsButton}
        onPress={() => {
          if (from === 'reservationDetails') router.back();
          else if (from === 'myTickets') router.replace('../profile/myTickets');
          else router.replace('/(tabs)/events'); 
        }}
      >
        <Text style={styles.backToEventsText}>
          {from === 'reservationDetails' ? t('buttons.back') :
          from === 'myTickets' ? t('buttons.backToMyTickets') : t('buttons.backToEvents')}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 35,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1e1e1e',
  },
  actions: {
  flexDirection: 'row',
  marginTop: 22,
  justifyContent: 'space-between',
  width: '100%',
},
button: {
  flex: 1,
  backgroundColor: '#5C5EE0',
  paddingVertical: 12,
  borderRadius: 10,
  marginHorizontal: 5,
  alignItems: 'center',
  shadowColor: '#5c5ee0',
  shadowOpacity: 0.35,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  maxWidth: 160, 
},
buttonSecondary: {
  flex: 1,
  backgroundColor: '#6B7280',
  paddingVertical: 12,
  borderRadius: 10,
  marginHorizontal: 5,
  alignItems: 'center',
  maxWidth: 160,
},
buttonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 16,
  textAlign: 'center',
},

  eventName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 10,
    color: '#3478f6',
  },
  detail: {
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'left',
    color: '#444',
  },
  ticketCard: {
    backgroundColor: '#fafafa',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 28,
    marginTop: 28,
    marginBottom: 36,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    alignItems: 'center',
  },
  ticketLabel: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 22, 
    color: '#333',
    textAlign: 'center',
    width: '100%',
  },
  backToEventsButton: {
    backgroundColor: '#1A56DB',
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 50,
    marginTop: 12,
    shadowColor: '#1a56db',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  backToEventsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 16,
    marginBottom: 16,
    color: '#555',
  },
    cardDetails: {
    marginTop: 14,
    alignSelf: 'stretch',
    width: '100%',
    paddingLeft: 8,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
  },
});
