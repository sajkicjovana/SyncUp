import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';

type CompactEventCardProps = {
  imageUri: string;
  imageLoading: boolean;
  title: string;
  date: string;
  location: string;
  priceLabel: string;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  favoriteAccessibilityLabel: string;
  onImageLoadStart: () => void;
  onImageLoadEnd: () => void;
};

export function CompactEventCard({
  imageUri,
  imageLoading,
  title,
  date,
  location,
  priceLabel,
  isFavorite,
  onPress,
  onToggleFavorite,
  favoriteAccessibilityLabel,
  onImageLoadStart,
  onImageLoadEnd,
}: CompactEventCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        {imageLoading && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          onLoadStart={onImageLoadStart}
          onLoad={onImageLoadEnd}
          onError={onImageLoadEnd}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metadataRow}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.metadata} numberOfLines={1}>
            {date}
          </Text>
        </View>
        <View style={styles.metadataRow}>
          <Ionicons name="location-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.metadata} numberOfLines={1}>
            {location}
          </Text>
        </View>
        <Text style={styles.price} numberOfLines={1}>
          {priceLabel}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        accessibilityRole="button"
        accessibilityLabel={favoriteAccessibilityLabel}
        hitSlop={4}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorite ? theme.colors.favorite : theme.colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 144,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: theme.shadow.color,
    shadowOpacity: theme.shadow.opacity,
    shadowOffset: theme.shadow.offset,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  imageWrapper: {
    width: 120,
    height: '100%',
    backgroundColor: theme.colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: theme.spacing.md,
    paddingRight: 48,
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metadata: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  price: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.xs,
  },
});
