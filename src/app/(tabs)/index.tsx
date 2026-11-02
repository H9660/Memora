import { StyleSheet, Text, View, Pressable, SectionList } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { MemoryCard } from "@/components/memory-card";
import { formatPlace, MemoryEvent } from "@/domain/memory-event";
import { useMemoryRepository } from "@/hooks/use-memory-repository";
import { getCaptureStatus } from "@/services/background-capture";
import { getCurrentLocation } from "@/services/location";

type DaySection = { title: string; data: MemoryEvent[] };

export default function HomeScreen() {
  const repository = useMemoryRepository();
  const [sections, setSections] = useState<DaySection[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [locationStatus, setLocationStatus] = useState("Checking...");
  const [capturing, setCapturing] = useState(false);

  // Reload whenever Home comes back into view, e.g. after saving a memory.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setCapturing(getCaptureStatus().running);

      repository
        .listRecent()
        .then((memories) => {
          if (!active) return;
          setSections(groupByDay(memories));
          setLoadError(false);
        })
        .catch(() => {
          if (active) setLoadError(true);
        });

      // Don't prompt for permission here; Capture asks when it's needed.
      getCurrentLocation({ requestPermission: false })
        .then((result) => {
          if (!active) return;
          setLocationStatus(
            result ? formatPlace(result) : "Added when you capture a memory",
          );
        })
        .catch(() => {
          if (active) setLocationStatus("Unavailable");
        });

      return () => {
        active = false;
      };
    }, [repository]),
  );

  return (
    <View style={styles.container}>
      <SectionList
        style={styles.list}
        sections={sections ?? []}
        keyExtractor={(memory) => memory.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            <Text style={styles.logo}>MEMORA</Text>

            <Text style={styles.subtitle}>Your personal memory companion</Text>

            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Current Context</Text>

              <Text style={styles.statusText}>📍 Location: {locationStatus}</Text>

              <Pressable onPress={() => router.push("/background")}>
                <Text style={styles.statusText}>
                  {capturing ? "🔴 Background capture: On" : "⚪ Background capture: Off"}
                  <Text style={styles.statusLink}>  Manage ›</Text>
                </Text>
              </Pressable>

              <Pressable onPress={() => router.push("/activity")}>
                <Text style={styles.statusText}>
                  🗂 Captured activity
                  <Text style={styles.statusLink}>  View ›</Text>
                </Text>
              </Pressable>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item }) => <MemoryCard memory={item} />}
        ListEmptyComponent={
          sections === null && !loadError ? undefined : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {loadError ? "Couldn't load your memories" : "No memories yet"}
              </Text>

              <Text style={styles.emptyText}>
                {loadError
                  ? "Please close and reopen Memora."
                  : "Memories you capture will appear here."}
              </Text>
            </View>
          )
        }
      />

      <Pressable style={styles.button} onPress={() => router.push("/capture")}>
        <Text style={styles.buttonText}>+ REMEMBER THIS</Text>
      </Pressable>
    </View>
  );
}

function groupByDay(memories: MemoryEvent[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const memory of memories) {
    const title = dayLabel(new Date(memory.capturedAt));
    const last = sections[sections.length - 1];
    if (last?.title === title) {
      last.data.push(memory);
    } else {
      sections.push({ title, data: [memory] });
    }
  }
  return sections;
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: "#F7F8FA",
  },

  list: {
    flex: 1,
  },

  logo: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1B1D22",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: "#6B7280",
  },

  statusCard: {
    marginTop: 28,
    marginBottom: 6,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },

  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  statusText: {
    fontSize: 14,
    color: "#555B66",
    marginTop: 6,
  },

  statusLink: {
    fontWeight: "700",
    color: "#1B1D22",
  },

  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#777E89",
    letterSpacing: 1,
  },

  emptyCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  emptyText: {
    marginTop: 6,
    color: "#6B7280",
  },

  button: {
    marginTop: 16,
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: "#1B1D22",
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
