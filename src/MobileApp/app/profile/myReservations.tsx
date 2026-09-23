import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { loadMyReservations } from '../../src/di/reservations';
import type { EventReservationSummary } from '../../src/application/reservations/ports';
import { theme } from '../../constants/theme';

export default function MyReservations() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const [reservations, setReservations] = useState<EventReservationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBack = useCallback(() => {
    if (from === 'profile') router.dismissTo('/(tabs)/profile');
    else router.back();
  }, [from, router]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || from !== 'profile') return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => subscription.remove();
    }, [from, handleBack])
  );

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const result = await loadMyReservations();
        if (result.status === 'missing-token') {
          setLoading(false);
          return;
        }

        if (result.status === 'non-ok') {
          console.warn('Failed to fetch reservations');
          setLoading(false);
          return;
        }

        setReservations(result.reservations);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('loading') || 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>{t('myReservations.title') || 'My Reservations'}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          reservations.length === 0 ? styles.emptyContent : styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {reservations.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="layers-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyText}>
              {t('myReservations.noReservations') || 'No reservations found'}
            </Text>
          </View>
        )}

        {reservations.map((event, index) => {
          const resourceNames = Array.from(new Set(event.Resources.map(r => r.Name))).join(', ');
          const totalQuantity = event.Resources.reduce((sum, r) => sum + r.Quantity, 0);

          return (
            <TouchableOpacity
              key={index}
              style={styles.eventCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '../event/reservationsDetails',
                  params: { eventID: event.EventID },
                })
              }
            >
              <View style={styles.accent}>
                <Ionicons name="layers-outline" size={22} color={theme.colors.primary} />
              </View>

              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.eventTitle}>{event.EventTitle}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={theme.colors.textMuted}
                  />
                </View>

                <Text style={styles.resourceText}>Resources: {resourceNames}</Text>

                <View style={styles.metadataRow}>
                  <View style={styles.metadataItem}>
                    <Ionicons
                      name="cube-outline"
                      size={16}
                      color={theme.colors.textMuted}
                    />
                    <Text style={styles.metadataText}>Quantity: {totalQuantity}</Text>
                  </View>
                  <View style={styles.metadataItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={theme.colors.textMuted}
                    />
                    <Text style={styles.metadataText}>
                      {new Date(event.EventDate).toLocaleDateString()} -{' '}
                      {new Date(event.EventEndDate).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flex: 1,
    marginRight: 44,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  eventCard: {
    flexDirection: 'row',
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
  accent: {
    width: 40,
    height: 40,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.control,
  },
  cardContent: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTitle: {
    flex: 1,
    marginRight: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  resourceText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  metadataRow: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
  metadataItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  metadataText: { flex: 1, color: theme.colors.textSecondary, fontSize: 12 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  loadingText: { marginTop: theme.spacing.sm, color: theme.colors.textSecondary },
  emptyContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    width: 56,
    height: 56,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.round,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
