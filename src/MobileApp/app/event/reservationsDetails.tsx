import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { loadReservationDetails } from '../../src/di/reservations';
import type { ReservationDetailsResource } from '../../src/application/reservations/ports';
import { theme } from '../../constants/theme';

export default function ReservationDetails() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventID: string | string[]; from?: string }>();
  const eventID = Array.isArray(params.eventID) ? params.eventID[0] : params.eventID;
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');
  const [reservations, setReservations] = useState<ReservationDetailsResource[]>([]);

useEffect(() => {
  const fetchDetails = async () => {
    try {
      const result = await loadReservationDetails(eventID);
      if (result.status === 'missing-token') {
        setLoading(false);
        return;
      }

      if (result.status === 'non-ok') {
        console.error('Failed to fetch reservations');
        setLoading(false);
        return;
      }

      if (!result.details) {
        setLoading(false);
        return;
      }

      setEventTitle(result.details.EventTitle);
      setReservations(result.details.Resources);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  fetchDetails();
}, [eventID]);


  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (reservations.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + theme.spacing.sm }]}>
        {eventTitle !== '' && <Text style={styles.emptyEventTitle}>{eventTitle}</Text>}
        <View style={styles.emptyIcon}>
          <Ionicons name="layers-outline" size={28} color={theme.colors.primary} />
        </View>
        <Text style={styles.noReservationsText}>{t('reservationDetails.noReservations')}</Text>
      </View>
    );
  }

  const userTickets = reservations[0].UserTickets;

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>Reservation Details</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.eventCard}>
          <View style={styles.eventIcon}>
            <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.eventContent}>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/event/[id]',
                  params: { id: eventID, from: 'reservationDetails' },
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.eventTitleRow}>
                <Text style={styles.eventTitle}>{eventTitle}</Text>
                <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
              </View>
            </TouchableOpacity>

            <View style={styles.eventDateRow}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.eventDate}>
                {new Date(reservations[0].EventDate).toLocaleDateString()} -{' '}
                {new Date(reservations[0].EventEndDate).toLocaleDateString()}
              </Text>
            </View>

            {userTickets.length > 0 && (
              <View style={styles.ticketSection}>
                <View style={styles.ticketHeadingRow}>
                  <Ionicons
                    name="ticket-outline"
                    size={17}
                    color={theme.colors.primaryDark}
                  />
                  <Text style={styles.ticketsInfo}>
                    {t('reservationDetails.youHaveTickets')}:
                  </Text>
                </View>
                <Text style={styles.ticketText}>
                  {Object.entries(
                    userTickets.reduce((acc: Record<string, number>, ticket) => {
                      const type = ticket.ticketType ?? 'Unknown';
                      acc[type] = (acc[type] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .map(([type, count]) => `${type} (x${count})`)
                    .join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resources</Text>
        {reservations.map(res => (
          <View key={res.ReservationID} style={styles.resourceCard}>
            <View style={styles.resourceHeader}>
              <View style={styles.resourceIcon}>
                <Ionicons name="cube-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.resourceName}>{res.ResourceName}</Text>
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityBadgeText}>x{res.Quantity}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="grid-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>{t('reservationDetails.category')}: </Text>
                {t(`reservationDetails.categoryNames.${res.ResourceCategory}`)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons
                name="document-text-outline"
                size={16}
                color={theme.colors.textMuted}
              />
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>{t('reservationDetails.description')}: </Text>
                {res.ResourceDescription}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="layers-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>{t('reservationDetails.quantity')}: </Text>
                {res.Quantity}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>{t('reservationDetails.reservedAt')}: </Text>
                {new Date(res.ReservedAt).toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flex: 1,
    marginRight: 44,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.xxl,
  },
  eventCard: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  eventIcon: {
    width: 40,
    height: 40,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.control,
  },
  eventContent: { flex: 1 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  eventTitle: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  eventDate: { flex: 1, color: theme.colors.textSecondary, fontSize: 13 },
  ticketSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  ticketHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  ticketsInfo: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  ticketText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: 19,
    fontWeight: '700',
  },
  resourceCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.control,
  },
  resourceName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  quantityBadge: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.round,
  },
  quantityBadgeText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  detailText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  detailLabel: { color: theme.colors.textPrimary, fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: { marginTop: theme.spacing.sm, color: theme.colors.textSecondary },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.screen,
    backgroundColor: theme.colors.background,
  },
  emptyEventTitle: {
    marginBottom: theme.spacing.lg,
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.round,
  },
  noReservationsText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
