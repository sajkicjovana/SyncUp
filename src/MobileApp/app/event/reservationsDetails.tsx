import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { loadReservationDetails } from '../../src/di/reservations';
import type { ReservationDetailsResource } from '../../src/application/reservations/ports';


export default function ReservationDetails() {
  const { t } = useTranslation();
  const router = useRouter();
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0047FF" />
        <Text style={{ marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
  }

  if (reservations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.eventTitle}>{eventTitle}</Text>
        <Text style={styles.noReservationsText}>{t('reservationDetails.noReservations')}</Text>
      </View>
    );
  }

  const userTickets = reservations[0].UserTickets;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color="black" />
      </TouchableOpacity>
    <View style={{ alignItems: 'center', marginBottom: 15 }}>
<TouchableOpacity
  disabled={userTickets.length === 0}
  onPress={() =>
    router.push({
      pathname: '/event/[id]',
      params: { id: eventID, from: 'reservationDetails' },
    })
  }
>
  <Text style={[styles.eventTitle, userTickets.length === 0 && { color: '#95a5a6' }]}>
    {eventTitle}
  </Text>
</TouchableOpacity>


  {/* Datum od-do */}
  <Text style={styles.eventDate}>
    {new Date(reservations[0].EventDate).toLocaleDateString()} - {new Date(reservations[0].EventEndDate).toLocaleDateString()}
  </Text>
{/* Tipovi karata */}
{userTickets.length > 0 && (
  <View style={{ marginTop: 10, alignItems: 'center' }}>
    <Text style={styles.ticketsInfo}>{t('reservationDetails.youHaveTickets')}:</Text>
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

{/* Lista resursa */}
<ScrollView style={{ marginTop: 10 }}>
  {reservations.map(res => (
    <View key={res.ReservationID} style={styles.resourceCard}>
      <Text style={styles.resourceName}>{res.ResourceName}</Text>
      {/* Tip resursa preveden */}
      <Text style={styles.detailText}>
        {t('reservationDetails.category')}:{' '}
        {t(`reservationDetails.categoryNames.${res.ResourceCategory}`)}
      </Text>
      <Text style={styles.detailText}>
        {t('reservationDetails.description')}: {res.ResourceDescription}
      </Text>
      <Text style={styles.detailText}>
        {t('reservationDetails.quantity')}: {res.Quantity}
      </Text>
      <Text style={styles.detailText}>
        {t('reservationDetails.reservedAt')}: {new Date(res.ReservedAt).toLocaleString()}
      </Text>
    </View>
  ))}
</ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: '#fff' },
  backButton: { marginBottom: 15 },
  eventTitle: { fontSize: 24, fontWeight: '700', color: '#3478f6', marginBottom: 10, textDecorationLine: 'underline' },
  ticketsInfo: { fontSize: 16, marginBottom: 15, color: '#2c3e50' },
  noReservationsText: { fontSize: 18, textAlign: 'center', marginTop: 50, color: '#95a5a6' },
  resourceCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 20, marginBottom: 20 },
  resourceName: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  detailText: { fontSize: 16, marginBottom: 6 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ticketCard: {
  backgroundColor: '#e1f0ff',
  borderRadius: 10,
  paddingVertical: 6,
  paddingHorizontal: 12,
  marginTop: 5,
},
ticketText: {
  fontSize: 14,
  fontWeight: '500',
  color: '#0047FF',
},
eventDate: { 
  fontSize: 16, 
  color: '#555', 
  marginBottom: 8 
},

});
