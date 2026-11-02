import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  CapturedPhoto,
  DayActivity,
  HourActivity,
  startOfLocalDay,
} from "@/domain/captured-activity";
import { getCapturedDay } from "@/services/background-capture";
import { lookUpPlaceName } from "@/services/location";

// Reverse geocoding is slow-ish and the same spots repeat, so cache by
// rounded coordinates (~10 m) for the life of the app.
const placeCache = new Map<string, string | null>();

function formatHour(start: number): string {
  const from = new Date(start).toLocaleTimeString(undefined, { hour: "numeric" });
  const to = new Date(start + 60 * 60 * 1000).toLocaleTimeString(undefined, { hour: "numeric" });
  return `${from} – ${to}`;
}

function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayTitle(day: Date): string {
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function CapturedActivityScreen() {
  const [day, setDay] = useState(() => startOfLocalDay(new Date()));
  const [activity, setActivity] = useState<DayActivity | null>(null);
  const [error, setError] = useState(false);
  const [openPhoto, setOpenPhoto] = useState<CapturedPhoto | null>(null);

  const isToday = day.getTime() === startOfLocalDay(new Date()).getTime();

  // Reload when the day changes or the screen regains focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCapturedDay(day)
        .then((result) => {
          if (!active) return;
          setActivity(result);
          setError(false);
        })
        .catch(() => {
          if (active) setError(true);
        });
      return () => {
        active = false;
      };
    }, [day]),
  );

  function shiftDay(days: number) {
    const next = new Date(day);
    next.setDate(day.getDate() + days);
    setActivity(null);
    setDay(next);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activity?.hours ?? []}
        keyExtractor={(hour) => String(hour.start)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.back}>← Back</Text>
            </Pressable>

            <Text style={styles.title}>Captured Activity</Text>
            <Text style={styles.subtitle}>What background capture recorded, hour by hour.</Text>

            <View style={styles.dayNav}>
              <Pressable
                style={styles.dayButton}
                onPress={() => shiftDay(-1)}
                accessibilityLabel="Previous day"
              >
                <Text style={styles.dayButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.dayTitle}>{dayTitle(day)}</Text>
              <Pressable
                style={[styles.dayButton, isToday && styles.disabled]}
                onPress={() => shiftDay(1)}
                disabled={isToday}
                accessibilityLabel="Next day"
              >
                <Text style={styles.dayButtonText}>›</Text>
              </Pressable>
            </View>

            {activity && activity.hours.length > 0 && <DaySummary activity={activity} />}
          </>
        }
        renderItem={({ item }) => <HourCard hour={item} onOpenPhoto={setOpenPhoto} />}
        ListEmptyComponent={
          activity === null && !error ? undefined : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {error ? "Couldn't load captured activity" : "Nothing captured on this day"}
              </Text>
              <Text style={styles.cardText}>
                {error
                  ? "Please try again."
                  : "Turn on background capture to record your day."}
              </Text>
            </View>
          )
        }
      />

      <PhotoViewer photo={openPhoto} onClose={() => setOpenPhoto(null)} />
    </View>
  );
}

function DaySummary({ activity }: { activity: DayActivity }) {
  const stats = [
    { value: activity.photoCount, label: "photos" },
    { value: activity.locationCount, label: "locations" },
    { value: activity.soundCount, label: "sound samples" },
    { value: activity.movingMinutes, label: "min moving" },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      {activity.rejectedPhotoCount > 0 && (
        <Text style={styles.cardHint}>
          {activity.rejectedPhotoCount} dark{" "}
          {activity.rejectedPhotoCount === 1 ? "photo was" : "photos were"} discarded.
        </Text>
      )}
    </View>
  );
}

function HourCard({
  hour,
  onOpenPhoto,
}: {
  hour: HourActivity;
  onOpenPhoto: (photo: CapturedPhoto) => void;
}) {
  const totalMinutes = hour.movingMinutes + hour.stillMinutes;

  return (
    <View style={styles.card}>
      <View style={styles.hourHeader}>
        <Text style={styles.hourTitle}>{formatHour(hour.start)}</Text>
        {hour.batteryLevel !== null && (
          <Text style={styles.cardHint}>🔋 {hour.batteryLevel}%</Text>
        )}
      </View>

      <PlaceLine hour={hour} />

      {totalMinutes > 0 && (
        <Text style={styles.cardText}>
          🚶 Moving {hour.movingMinutes} min · Still {hour.stillMinutes} min
        </Text>
      )}

      {hour.soundCounts.length > 0 && (
        <Text style={styles.cardText}>
          🔊 {hour.soundCounts.map(({ label, count }) => `${label} ×${count}`).join(", ")}
        </Text>
      )}

      {hour.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
          {hour.photos.map((photo) => (
            <Pressable
              key={photo.t}
              onPress={() => onOpenPhoto(photo)}
              accessibilityLabel={`Photo taken at ${formatTime(photo.t)}`}
            >
              <Image source={{ uri: photo.uri }} style={styles.thumbnail} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Shows where the phone was for most of the hour: the last location fix,
// named by reverse geocoding when possible.
function PlaceLine({ hour }: { hour: HourActivity }) {
  const last = hour.locations[hour.locations.length - 1];
  const key = last ? `${last.lat.toFixed(4)},${last.lon.toFixed(4)}` : null;
  const [place, setPlace] = useState<string | null | undefined>(
    key ? placeCache.get(key) : null,
  );

  useEffect(() => {
    if (!last || !key || placeCache.has(key)) return;
    let active = true;
    lookUpPlaceName(last.lat, last.lon)
      .catch(() => null)
      .then((name) => {
        placeCache.set(key, name);
        if (active) setPlace(name);
      });
    return () => {
      active = false;
    };
  }, [last, key]);

  if (!last) {
    return <Text style={styles.cardHint}>📍 No location this hour</Text>;
  }

  const coordinates = `${last.lat.toFixed(4)}, ${last.lon.toFixed(4)}`;
  return (
    <Text style={styles.cardText}>
      📍 {place ?? coordinates}
      {hour.locations.length > 1 && (
        <Text style={styles.cardHint}>  · {hour.locations.length} fixes</Text>
      )}
    </Text>
  );
}

function PhotoViewer({ photo, onClose }: { photo: CapturedPhoto | null; onClose: () => void }) {
  return (
    <Modal visible={photo !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {photo && (
          <>
            <Image source={{ uri: photo.uri }} style={styles.viewerImage} contentFit="contain" />
            <Text style={styles.viewerCaption}>
              {new Date(photo.t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              {" · "}
              {photo.trigger === "moving" ? "taken while you were moving" : "taken on the regular interval"}
            </Text>
          </>
        )}
        <Pressable style={styles.viewerClose} onPress={onClose} accessibilityLabel="Close photo">
          <Text style={styles.viewerCloseText}>CLOSE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  content: {
    padding: 24,
    paddingTop: 60,
  },

  back: {
    fontSize: 16,
    color: "#555B66",
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1B1D22",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#6B7280",
  },

  dayNav: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E9EBEF",
    alignItems: "center",
    justifyContent: "center",
  },

  dayButtonText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B1D22",
  },

  dayTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1B1D22",
  },

  disabled: {
    opacity: 0.3,
  },

  card: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B1D22",
  },

  cardText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1B1D22",
  },

  cardHint: {
    fontSize: 13,
    color: "#777E89",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  stat: {
    alignItems: "center",
    flex: 1,
  },

  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B1D22",
  },

  statLabel: {
    marginTop: 2,
    fontSize: 12,
    color: "#777E89",
    textAlign: "center",
  },

  hourHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  hourTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B1D22",
  },

  photoStrip: {
    gap: 8,
    paddingTop: 4,
  },

  thumbnail: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: "#E9EBEF",
  },

  viewer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    padding: 16,
  },

  viewerImage: {
    flex: 1,
  },

  viewerCaption: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 14,
    color: "#E5E7EB",
  },

  viewerClose: {
    marginTop: 16,
    marginBottom: 24,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },

  viewerCloseText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B1D22",
  },
});
