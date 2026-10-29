import { StyleSheet, Text, View } from "react-native";

import { formatPlace, MemoryEvent } from "@/domain/memory-event";

export function MemoryCard({ memory }: { memory: MemoryEvent }) {
  const time = new Date(memory.capturedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const place = memory.location && formatPlace(memory.location);

  return (
    <View style={styles.card}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.note} numberOfLines={3}>
        {memory.note}
      </Text>
      {place && <Text style={styles.place}>📍 {place}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
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
});
