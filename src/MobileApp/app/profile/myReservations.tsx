import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler, Platform } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { loadMyReservations } from '../../src/di/reservations';
import type { EventReservationSummary } from '../../src/application/reservations/ports';

export default function MyReservations() {
  const { t } = useTranslation();
  const router = useRouter();
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3478f6" />
        <Text style={{ marginTop: 10 }}>{t('loading') || 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.header}>{t('myReservations.title') || 'My Reservations'}</Text>
      </View>

      <ScrollView style={styles.scroll}>
        {reservations.length === 0 && (
          <Text style={{ textAlign: 'center', marginTop: 50 }}>{t('myReservations.noReservations') || 'No reservations found'}</Text>
        )}

        {reservations.map((event, index) => {
          const resourceNames = Array.from(new Set(event.Resources.map(r => r.Name))).join(', ');
          const totalQuantity = event.Resources.reduce((sum, r) => sum + r.Quantity, 0);

          return (
            <TouchableOpacity
              key={index}
              style={styles.eventCard}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: `../event/reservationsDetails`, params: { eventID: event.EventID } })}
            >
              <Text style={styles.eventTitle}>{event.EventTitle}</Text>
              <Text style={styles.resourceText}>Resources: {resourceNames}</Text>
              <Text style={styles.quantityText}>Quantity: {totalQuantity}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 35, paddingBottom: 30 },
  backButton: { marginRight: 12, padding: 6, borderRadius: 8 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', flex: 1, textAlign: 'center', marginRight: 40 },

  eventCard: {
    backgroundColor: '#fefefe',
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  eventTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#3478f6' },
  resourceText: { fontSize: 16, marginBottom: 4 },
  quantityText: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});
