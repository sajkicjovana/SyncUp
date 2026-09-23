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

type EventCardProps = {
  imageUri: string;
  imageLoading: boolean;
  title: string;
  dateTime: string;
  location: string;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  favoriteAccessibilityLabel: string;
  onImageLoadStart: () => void;
  onImageLoadEnd: () => void;
};

export function EventCard({
  imageUri,
  imageLoading,
  title,
  dateTime,
  location,
  isFavorite,
  onPress,
  onToggleFavorite,
  favoriteAccessibilityLabel,
  onImageLoadStart,
  onImageLoadEnd,
}: EventCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        {imageLoading && (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          onLoadStart={onImageLoadStart}
          onLoadEnd={onImageLoadEnd}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.metadataRow}>
          <Ionicons name="time-outline" size={17} color={theme.colors.textMuted} />
          <Text style={styles.metadata} numberOfLines={1}>
            {dateTime}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={17} color={theme.colors.textMuted} />
            <Text style={styles.metadata} numberOfLines={2}>
              {location}
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
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
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
    width: '100%',
    aspectRatio: 1.9,
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: theme.spacing.sm,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  locationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  metadata: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    marginTop: -6,
    borderRadius: theme.radii.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
