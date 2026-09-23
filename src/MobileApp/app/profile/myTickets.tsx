import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMyTickets } from '../../src/di/myTickets';
import { MyTicketsTokenReadError } from '../../src/application/myTickets/useCases';
import type { GroupedMyTicket } from '../../src/application/myTickets/ports';
import { theme } from '../../constants/theme';

export default function ProfileTickets() {
  const [groupedTickets, setGroupedTickets] = useState<GroupedMyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const { t } = useTranslation();

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
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const result = await loadMyTickets();
        if (result.status === 'missing-token') {
          setLoading(false);
          return;
        }

        if (result.status === 'non-ok') {
          console.warn('Failed to fetch tickets');
          setLoading(false);
          return;
        }

        setGroupedTickets(result.tickets);
      } catch (error) {
        if (error instanceof MyTicketsTokenReadError) throw error;
        console.error(error);
      }
      setLoading(false);
    };

    fetchTickets();
  }, []);

  const renderItem = ({ item }: { item: GroupedMyTicket }) => (
    <TouchableOpacity
      style={styles.ticketItem}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '../event/ticketDetails',
          params: {
            ticketIDs: JSON.stringify(item.ticketIds),
            validationTokens: JSON.stringify(item.validationTokens),
            eventName: item.eventName,
            ticketType: item.ticketType,
            eventID: item.eventId,
            purchasedAt: JSON.stringify(item.purchasedAt),
            price: item.price.toString(),
            from: 'myTickets', 
          },
        });
      }}
    >
      <View style={styles.accent}>
        <Ionicons name="ticket-outline" size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.ticketContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.eventName}</Text>
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
        </View>
        <Text style={styles.ticketType}>{item.ticketType}</Text>
        <View style={styles.metadata}>
          <View style={styles.metadataItem}>
            <Text style={styles.label}>{t('profileTickets.quantity')}</Text>
            <Text style={styles.value}>{item.quantity}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.label}>{t('profileTickets.price')}</Text>
            <Text style={styles.value}>{item.price} RSD</Text>
          </View>
        </View>
        <View style={styles.purchaseDate}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.dateText}>
            {new Date(item.purchasedAt[item.purchasedAt.length - 1]).toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>{t('profileTickets.title') || 'My Tickets'}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7069E1" />
        </View>
      ) : (
        groupedTickets.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('profileTickets.noTickets')}</Text>
          </View>
        ) : (
          <FlatList
            data={groupedTickets}
            keyExtractor={(item, index) =>
              item.ticketIds.length > 0
                ? item.ticketIds.join('-')
                : `${item.eventName}-${item.ticketType}-${index}`
            }
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.lg },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary, flex: 1, textAlign: 'center', marginRight: 44 },
  ticketItem: { flexDirection: 'row', backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderRadius: theme.radii.card, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, shadowColor: theme.shadow.color, shadowOpacity: theme.shadow.opacity, shadowOffset: theme.shadow.offset, shadowRadius: theme.shadow.radius, elevation: theme.shadow.elevation },
  accent: { width: 40, height: 40, borderRadius: theme.radii.control, backgroundColor: theme.colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md },
  ticketContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary, marginRight: theme.spacing.sm },
  ticketType: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 3 },
  metadata: { flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.md },
  metadataItem: { gap: 2 },
  label: { fontSize: 12, color: theme.colors.textMuted },
  value: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  purchaseDate: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  dateText: { fontSize: 12, color: theme.colors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  emptyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center' },
});
