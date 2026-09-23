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
import { theme } from '../../constants/theme';

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
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.statusText}>
          {t('tickets.loading')}
        </Text>
      </View>
    );
  }

  if (redirecting) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.statusText}>
          {t('tickets.redirecting')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.sectionHeading}>
        <Ionicons name="ticket-outline" size={22} color={theme.colors.primary} />
        <Text style={styles.sectionTitle}>{t('tickets.title')}</Text>
      </View>
      {tickets.length === 0 ? (
        <Text style={styles.emptyText}>{t('tickets.noTickets')}</Text>
      ) : (
        tickets.map(ticket => {
          const selectedCount = cart[ticket.id] || 0;
          const remaining = ticket.available - selectedCount;

          return (
            <View
              key={`ticket-${ticket.id}`}
              style={[styles.card, selectedCount > 0 && styles.selectedTicketCard]}
            >
              <Text style={styles.cardTitle}>{ticket.name}</Text>
              <Text style={styles.priceText}>{ticket.price} RSD</Text>
              <Text style={styles.cardText}>
                {remaining} {t('tickets.available')}
              </Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  onPress={() => handleRemoveFromCart(ticket.id)}
                  style={styles.counterButton}
                >
                  <Ionicons name="remove" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{selectedCount}</Text>
                <TouchableOpacity
                  onPress={() => handleAddToCart(ticket.id)}
                  style={styles.counterButton}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.sectionHeading}>
        <Ionicons name="cube-outline" size={22} color={theme.colors.primary} />
        <Text style={styles.sectionTitle}>{t('resources.title')}</Text>
      </View>
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
                styles.resourceCard,
                selectedResources.has(res.id) && styles.selectedResourceCard,
                disabled && styles.disabledResourceCard,
              ]}
              onPress={() => !disabled && toggleResource(res.id)}
              activeOpacity={disabled ? 1 : 0.7}
            >
              <Ionicons
                name={selectedResources.has(res.id) ? 'checkbox' : 'square-outline'}
                size={24}
                color={disabled ? theme.colors.disabled : theme.colors.primary}
                style={{ marginRight: 10 }}
              />
              <View style={styles.resourceContent}>
                <Text style={[styles.cardTitle, disabled && styles.disabledText]}>
                  {res.name}
                </Text>
                <Text style={[styles.cardText, disabled && styles.disabledText]}>
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
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  selectedTicketCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.xs,
  },
  cardText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    alignSelf: 'flex-end',
  },
  counterButton: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: theme.spacing.xs,
  },
  counterValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  selectedResourceCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  disabledResourceCard: {
    opacity: 0.55,
  },
  resourceContent: {
    flexShrink: 1,
  },
  disabledText: {
    color: theme.colors.disabled,
  },
  proceedButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.control,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: 50,
  },
  proceedText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backButton: { paddingVertical: theme.spacing.md, paddingHorizontal: 0 },
  statusText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginVertical: theme.spacing.sm,
    textAlign: 'center',
  },
});
