import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadCartDisplayData, purchaseStandardCart, reserveResourcesWithoutTicket } from '../../src/di/cart';
import { CartStandardPurchaseError } from '../../src/application/cart/useCases';
import type { CartTicketDisplayItem, CartResourceDisplayItem } from '../../src/application/cart/ports';
import { readAuthToken } from '../../src/di/auth';
import { theme } from '../../constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tickets, resources, eventId, eventName, eventLocation } = useLocalSearchParams();

  const [selectedTickets, setSelectedTickets] = useState<{ id: number; quantity: number }[]>([]);
  const [selectedResources, setSelectedResources] = useState<number[]>([]);
  const [ticketData, setTicketData] = useState<CartTicketDisplayItem[]>([]);
  const [resourceData, setResourceData] = useState<CartResourceDisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { readAuthToken().then(setToken); }, []);

  useEffect(() => {
    const parsedTickets = tickets ? JSON.parse(tickets as string) : {};
    const parsedResources = resources ? JSON.parse(resources as string) : [];

    const ticketArray = Object.entries(parsedTickets).map(([id, quantity]) => ({
      id: Number(id),
      quantity: Number(quantity),
    }));

    setSelectedTickets(ticketArray);
    setSelectedResources(parsedResources);
  }, [tickets, resources]);

  useEffect(() => {
    if (!eventId) return;

    const fetchTicketsAndResources = async () => {
      try {
        const { tickets: loadedTickets, resources: loadedResources } = await loadCartDisplayData(eventId, token);

        setTicketData(loadedTickets);
        setResourceData(loadedResources);
      } catch {
        Alert.alert(t('cart.errorTitle'), t('cart.fetchError'));
      }
    };

    fetchTicketsAndResources();
  }, [eventId, token]);

  const getTicketInfo = (id: number) => ticketData.find(t => t.id === id);
  const getResourceInfo = (id: number) => resourceData.find(r => r.id === id);

  const calculateTotal = () => {
    let total = 0;
    selectedTickets.forEach(t => { const info = getTicketInfo(t.id); if (info) total += info.price * t.quantity; });
    selectedResources.forEach(resId => { const info = getResourceInfo(resId); if (info?.price) total += info.price; });
    return total;
  };

  const handlePurchaseOrReserve = async () => {
    const onlyResources = selectedTickets.length === 0 && selectedResources.length > 0;

    if (onlyResources) {
      // Rezervacija samo resursa
      Alert.alert(
        t('cart.confirmTitle2'),
        t('cart.confirmReserveMessage') || 'Da li želite da rezervišete resurs?',
        [
          { text: t('cart.cancel'), style: 'cancel' },
          {
            text: t('cart.reserveBtn'),
            onPress: async () => {
              setLoading(true);
              try {
                if (!token) { Alert.alert(t('cart.errorTitle'), t('cart.loginRequired')); setLoading(false); return; }

                await reserveResourcesWithoutTicket(selectedResources, token);

                setLoading(false);
                Alert.alert(
                  t('cart.successTitle'),
                  t('cart.resourceReservedMessage') || 'Resurs je uspešno rezervisan.',
                  [{ text: t('cart.backToEvents'), onPress: () => router.replace('/(tabs)/events'), style: 'default' }],
                  { cancelable: false }
                );
              } catch (error: any) {
                setLoading(false);
                Alert.alert(t('cart.errorTitle'), error.message || t('cart.genericError'));
              }
            },
          },
        ]
      );
    } else {
      // Standardna kupovina karata + eventualno resursa
      Alert.alert(t('cart.confirmTitle'), t('cart.confirmMessage'), [
        { text: t('cart.cancel'), style: 'cancel' },
        {
          text: t('cart.purchase'),
          onPress: async () => {
            setLoading(true);
            try {
              if (!token) { Alert.alert(t('cart.errorTitle'), t('cart.loginRequired')); setLoading(false); return; }

              const newlyPurchasedTickets = await purchaseStandardCart({
                eventId: Number(eventId),
                selectedTickets,
                selectedResourceIds: selectedResources,
                token,
              });

              const ticketIDs = newlyPurchasedTickets.map(ticket => ticket.userTicketId);
              const validationTokens = newlyPurchasedTickets.map(ticket => ticket.validationToken);
              const ticketTypes = selectedTickets.map(t => {
                const info = getTicketInfo(t.id);
                return { id: t.id, name: info?.name || '', quantity: t.quantity };
              });

              setLoading(false);
              Alert.alert(
                t('cart.successTitle'),
                t('cart.successMessage'),
                [
                  {
                    text: t('cart.viewTicket'),
                    onPress: () =>
                      router.replace({
                        pathname: '../event/ticketDetails',
                        params: {
                          ticketIDs: JSON.stringify(ticketIDs),
                          validationTokens: JSON.stringify(validationTokens),
                          eventName: eventName ?? '',
                          ticketTypes: JSON.stringify(ticketTypes),
                          purchasedAt: new Date().toISOString(),
                          eventID: eventId?.toString() ?? '',
                          price: calculateTotal().toString(),
                          location: eventLocation ?? '',
                        },
                      }),
                  },
                  { text: t('cart.backToEvents'), onPress: () => router.replace('/(tabs)/events'), style: 'cancel' },
                ],
                { cancelable: false }
              );
            } catch (error: any) {
              setLoading(false);
              const errorMessage = error instanceof CartStandardPurchaseError
                ? error.stage === 'beforeTickets'
                  ? t('cart.fetchMyTicketsFailed')
                  : error.stage === 'purchase'
                    ? t('cart.purchaseFailed', { error: error.responseText })
                    : t('cart.fetchAfterPurchaseFailed')
                : error.message || t('cart.genericError');
              Alert.alert(t('cart.errorTitle'), errorMessage || t('cart.genericError'));
            }
          },
        },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title}>{t('cart.title')}</Text>

      <View style={styles.sectionHeading}>
        <Ionicons name="ticket-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.sectionTitle}>{t('cart.tickets')}</Text>
      </View>
      <View style={styles.summaryCard}>
        {selectedTickets.length === 0 && <Text style={styles.emptyText}>{t('cart.noTickets')}</Text>}
        {selectedTickets.map(ticket => {
          const info = getTicketInfo(ticket.id);
          if (!info) return null;
          return (
            <View key={`ticket-${ticket.id}`} style={styles.itemRow}>
              <Text style={styles.itemText}>{info.name} x {ticket.quantity}</Text>
              <Text style={styles.itemPrice}>{info.price * ticket.quantity} RSD</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionHeading}>
        <Ionicons name="cube-outline" size={21} color={theme.colors.primary} />
        <Text style={styles.sectionTitle}>{t('cart.resources')}</Text>
      </View>
      <View style={styles.summaryCard}>
        {selectedResources.length === 0 && <Text style={styles.emptyText}>{t('cart.noResources')}</Text>}
        {selectedResources.map(resId => {
          const res = getResourceInfo(resId);
          if (!res) return null;
          return (
            <View key={`res-${resId}`} style={styles.itemRow}>
              <Text style={styles.itemText}>{res.name}</Text>
              <Text style={styles.itemPrice}>{res.price ? `${res.price} RSD` : t('cart.free')}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalText}>{t('cart.total')}:</Text>
        <Text style={styles.totalText}>{calculateTotal()} RSD</Text>
      </View>

      <TouchableOpacity
        style={styles.purchaseButton}
        onPress={handlePurchaseOrReserve}
        disabled={loading || (selectedTickets.length === 0 && selectedResources.length === 0)}
      >
        <Text style={styles.purchaseText}>
          {loading
            ? t('cart.purchasing')
            : selectedTickets.length === 0 && selectedResources.length > 0
              ? t('cart.reserveBtn')
              : t('cart.purchase')}
        </Text>
      </TouchableOpacity>

      {loading && (
        <View style={{ marginTop: 20 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
  },
  backArrow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 0,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    gap: theme.spacing.md,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  itemPrice: {
    fontSize: 16,
    color: theme.colors.primaryDark,
    fontWeight: '700',
  },
  emptyText: {
    paddingVertical: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
  },
  totalText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  purchaseButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.control,
    alignItems: 'center',
  },
  purchaseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
