import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";

import { formatPlace, getPhotoUri, MemoryEvent } from "@/domain/memory-event";

type Props = {
  memory: MemoryEvent;
  showDate?: boolean;
  footer?: string;
};

export function MemoryCard({ memory, showDate = false, footer }: Props) {
  const captured = new Date(memory.capturedAt);
  const time = showDate
    ? captured.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : captured.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const place = memory.location && formatPlace(memory.location);
  const photoUri = getPhotoUri(memory);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() =>
        router.push({ pathname: "/memory/[id]", params: { id: memory.id } })
      }
    >
      <View style={styles.text}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.note} numberOfLines={3}>
          {memory.note}
        </Text>
        {place && <Text style={styles.place}>📍 {place}</Text>}
        {footer && <Text style={styles.footer}>{footer}</Text>}
      </View>

      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.thumbnail} contentFit="cover" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    gap: 14,
  },

  pressed: {
    opacity: 0.7,
  },

  text: {
    flex: 1,
  },

  time: {
    fontSize: 13,
    fontWeight: "600",
    color: "#777E89",
  },

  note: {
    marginTop: 6,
    fontSize: 16,
    color: "#1B1D22",
  },

  place: {
    marginTop: 8,
    fontSize: 13,
    color: "#555B66",
  },

  footer: {
    marginTop: 8,
    fontSize: 12,
    color: "#777E89",
  },

  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
});
