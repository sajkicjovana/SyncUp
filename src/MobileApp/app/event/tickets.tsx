import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loadTicketSelectionOptions } from '../../src/di/ticketSelection';
import type { TicketOption, ResourceOption } from '../../src/application/ticketSelection/ports';

export default function TicketPurchaseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [tickets, setTickets] = useState<TicketOption[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [cart, setCart] = useState<{ [key: number]: number }>({});
  const [selectedResources, setSelectedResources] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  // Događaj je besplatan ako nema karata
  const isFreeEvent = tickets.length === 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { tickets: mappedTickets, resources: mappedResources } = await loadTicketSelectionOptions(eventId);

        setTickets(mappedTickets);
        setResources(mappedResources);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const handleAddToCart = (ticketId: number) => {
    const selectedCount = cart[ticketId] || 0;
    const availableCount = tickets.find(t => t.id === ticketId)?.available || 0;
    if (selectedCount < availableCount) {
      setCart(prev => ({ ...prev, [ticketId]: selectedCount + 1 }));
    }
  };

  const handleRemoveFromCart = (ticketId: number) => {
    setCart(prev => {
      const updated = { ...prev };
      if (updated[ticketId] > 0) updated[ticketId] -= 1;
      if (updated[ticketId] === 0) delete updated[ticketId];

      // Ako događaj nije besplatan i nema više karata u korpi, ukloni sve resurse
      if (!isFreeEvent && Object.keys(updated).length === 0) {
        setSelectedResources(new Set());
      }

      return updated;
    });
  };

  const toggleResource = (resId: number) => {
    if (!isFreeEvent && Object.keys(cart).length === 0) {
      alert('Da biste rezervisali resurs, morate prvo kupiti kartu.');
      return;
    }

    setSelectedResources(prev => {
      const updated = new Set(prev);
      updated.has(resId) ? updated.delete(resId) : updated.add(resId);
      return updated;
    });
  };

  const handleProceed = () => {
    if (!isFreeEvent && Object.keys(cart).length === 0 && selectedResources.size > 0) {
      alert('Da biste rezervisali resurs, morate prvo kupiti kartu.');
      return;
    }

    setRedirecting(true);
    setTimeout(() => {
      router.push({
        pathname: './cart',
        params: {
          eventId: eventId?.toString(),
          tickets: JSON.stringify(cart),
          resources: JSON.stringify(Array.from(selectedResources)),
        },
      });
    }, 1000);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0047FF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#0047FF' }}>
          {t('tickets.loading')}
        </Text>
      </View>
    );
  }

  if (redirecting) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0047FF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#0047FF' }}>
          {t('tickets.redirecting')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>🎫 {t('tickets.title')}</Text>
      {tickets.length === 0 ? (
        <Text style={styles.emptyText}>{t('tickets.noTickets')}</Text>
      ) : (
        tickets.map(ticket => {
          const selectedCount = cart[ticket.id] || 0;
          const remaining = ticket.available - selectedCount;

          return (
            <View key={`ticket-${ticket.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>{ticket.name}</Text>
              <Text style={styles.cardText}>
                {ticket.price} RSD - {remaining} {t('tickets.available')}
              </Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  onPress={() => handleRemoveFromCart(ticket.id)}
                  style={styles.counterButton}
                >
                  <Text style={styles.counterText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{selectedCount}</Text>
                <TouchableOpacity
                  onPress={() => handleAddToCart(ticket.id)}
                  style={styles.counterButton}
                >
                  <Text style={styles.counterText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>📦 {t('resources.title')}</Text>
      {resources.length === 0 ? (
        <Text style={styles.emptyText}>{t('resources.noResources')}</Text>
      ) : (
        resources.map(res => {
          const disabled = !isFreeEvent && Object.keys(cart).length === 0;

          return (
            <TouchableOpacity
              key={`res-${res.id}`}
              style={[
                styles.card,
                { flexDirection: 'row', alignItems: 'center', opacity: disabled ? 0.5 : 1 }
              ]}
              onPress={() => !disabled && toggleResource(res.id)}
              activeOpacity={disabled ? 1 : 0.7}
            >
              <Ionicons
                name={selectedResources.has(res.id) ? 'checkbox' : 'square-outline'}
                size={24}
                color={disabled ? '#999' : '#0047FF'}
                style={{ marginRight: 10 }}
              />
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.cardTitle, { color: disabled ? '#999' : '#333' }]}>
                  {res.name}
                </Text>
                <Text style={[styles.cardText, { color: disabled ? '#999' : '#666' }]}>
                  {res.price ? `${res.price} RSD - ` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity
        style={styles.proceedButton}
        onPress={handleProceed}
      >
        <Text style={styles.proceedText}>{t('tickets.proceed')}</Text>
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
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginVertical: 16, color: '#0047FF' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  cardText: { fontSize: 14, color: '#666', marginTop: 4 },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  counterButton: {
    width: 36,
    height: 36,
    backgroundColor: '#0047FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  counterText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  counterValue: { fontSize: 16, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  proceedButton: {
    backgroundColor: '#0047FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 50,
  },
  proceedText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  backButton: { padding: 20 },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginVertical: 8,
    textAlign: 'center',
  },
});
