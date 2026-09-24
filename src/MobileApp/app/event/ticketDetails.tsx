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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadPersonalInfo } from '../../src/di/profile';
import { buildTicketValidationUrl } from '../../src/di/ticketDetails';
import { theme } from '../../constants/theme';

type TicketType = {
  id: number;
  name: string;
  quantity: number;
};

export default function TicketDetails() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ticketIDs, validationTokens, eventName, eventID, purchasedAt, ticketTypes, from } = useLocalSearchParams();
  const { ticketType } = useLocalSearchParams<{ ticketType?: string | string[] }>();


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
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>{t('ticketDetails.title')}</Text>
      </View>

    {ids.map((id, index) => {
      const token = tokens[index];
      const purchaseDate = purchasedDates[index]
        ? new Date(purchasedDates[index]).toLocaleString()
        : t('ticketDetails.unknownDate');



      return (
        <View key={index} style={styles.ticketCard}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: `../event/${eventID}`,
                params: { from: 'ticketDetails' },
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.eventName}>{displayEventName}</Text>
          </TouchableOpacity>
          <Text style={styles.ticketLabel}>{ticketType || parsedTicketTypes[index]?.name || t('ticketDetails.ticket')} </Text>
          <Text style={styles.ticketNumber}>{t('ticketDetails.ticket')} #{index + 1}</Text>

          {token ? (
            <QRCode
              value={buildTicketValidationUrl(id, token)}
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
            <Text style={styles.detail}>
              {t('ticketDetails.purchasedBy')}: <Text style={styles.detailValue}>{fullName ?? t('ticketDetails.unknownUser')}</Text>
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => downloadQR(index)} style={styles.button}>
              <Ionicons name="download-outline" size={18} color={theme.colors.surface} />
              <Text style={styles.buttonText}>{t('buttons.download')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => shareQR(index)} style={styles.buttonSecondary}>
              <Ionicons name="share-outline" size={18} color={theme.colors.textPrimary} />
              <Text style={styles.buttonSecondaryText}>{t('buttons.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    })}


      <TouchableOpacity
        style={styles.backToEventsButton}
        onPress={() => {
          if (from === 'reservationDetails') router.back();
          else if (from === 'myTickets') router.back();
          else router.dismissTo('/(tabs)/events');
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
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screen,
  },
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  header: { flex: 1, fontSize: 24, fontWeight: '700', textAlign: 'center', color: theme.colors.textPrimary, marginRight: 44 },
  eventName: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  actions: { flexDirection: 'row', marginTop: theme.spacing.lg, gap: theme.spacing.sm, width: '100%' },
  button: { flex: 1, flexDirection: 'row', gap: theme.spacing.sm, backgroundColor: theme.colors.primary, paddingVertical: theme.spacing.md, borderRadius: theme.radii.control, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { flex: 1, flexDirection: 'row', gap: theme.spacing.sm, backgroundColor: theme.colors.primarySoft, paddingVertical: theme.spacing.md, borderRadius: theme.radii.control, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: theme.colors.surface, fontWeight: '700', fontSize: 14 },
  buttonSecondaryText: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 },
  detail: {
    fontSize: 14,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  detailValue: { fontWeight: '600', color: theme.colors.textPrimary },
  ticketCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: theme.spacing.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', shadowColor: theme.shadow.color, shadowOpacity: theme.shadow.opacity, shadowOffset: theme.shadow.offset, shadowRadius: theme.shadow.radius, elevation: theme.shadow.elevation },
  ticketLabel: { fontSize: 16, fontWeight: '700', marginBottom: theme.spacing.xs, color: theme.colors.primaryDark, textAlign: 'center' },
  ticketNumber: { fontSize: 12, color: theme.colors.textMuted, marginBottom: theme.spacing.lg },
  backToEventsButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.control,
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
    marginTop: theme.spacing.sm,
  },
  backToEventsText: { color: theme.colors.surface, fontSize: 15, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  loadingText: { marginTop: theme.spacing.sm, color: theme.colors.textSecondary },
  cardDetails: {
    marginTop: theme.spacing.lg,
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: theme.spacing.sm,
  },
  errorText: { color: '#B42318', textAlign: 'center', marginTop: theme.spacing.lg, fontWeight: '600' },
});
