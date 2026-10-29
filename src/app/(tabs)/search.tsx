import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { MemoryCard } from "@/components/memory-card";
import { useMemoryRetriever } from "@/hooks/use-memory-repository";
import { MatchedField, SearchResult } from "@/retrieval/memory-retriever";

type Range = "any" | "today" | "week" | "month";

const RANGES: { value: Range; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Past 7 days" },
  { value: "month", label: "Past 30 days" },
];

const FIELD_LABELS: Record<MatchedField, string> = {
  note: "your note",
  place: "place",
};

function rangeStart(range: Range): Date | undefined {
  if (range === "any") return undefined;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === "week") start.setDate(start.getDate() - 6);
  if (range === "month") start.setDate(start.getDate() - 29);
  return start;
}

export default function SearchScreen() {
  const retriever = useMemoryRetriever();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("any");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState(false);

  // Re-runs when the query or range changes, and when the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      retriever
        .search(query, { since: rangeStart(range) })
        .then((found) => {
          if (!active) return;
          setResults(found);
          setError(false);
        })
        .catch(() => {
          if (active) setError(true);
        });

      return () => {
        active = false;
      };
    }, [retriever, query, range]),
  );

  const hasFilter = query.trim().length > 0 || range !== "any";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>

      <TextInput
        style={styles.input}
        placeholder="Search notes and places..."
        placeholderTextColor="#9CA3AF"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View style={styles.chips}>
        {RANGES.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.chip, range === option.value && styles.chipSelected]}
            onPress={() => setRange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === option.value }}
          >
            <Text
              style={[
                styles.chipText,
                range === option.value && styles.chipTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {results && (
        <Text style={styles.count}>
          {results.length} {results.length === 1 ? "memory" : "memories"}
        </Text>
      )}

      <FlatList
        style={styles.list}
        data={results ?? []}
        keyExtractor={(result) => result.memory.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <MemoryCard
            memory={item.memory}
            showDate
            footer={
              item.matchedFields.length > 0
                ? `Matched in ${item.matchedFields.map((f) => FIELD_LABELS[f]).join(" and ")}`
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          results === null && !error ? undefined : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {error
                  ? "Search isn't working right now"
                  : hasFilter
                    ? "No matching memories"
                    : "No memories yet"}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? "Please close and reopen Memora."
                  : hasFilter
                    ? "Try another word or a wider time range."
                    : "Memories you capture will appear here."}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    paddingBottom: 0,
    backgroundColor: "#F7F8FA",
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1B1D22",
  },

  input: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E9EBEF",
  },

  chipSelected: {
    backgroundColor: "#1B1D22",
  },

  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1B1D22",
  },

  chipTextSelected: {
    color: "#FFFFFF",
  },

  count: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#777E89",
    letterSpacing: 1,
  },

  list: {
    flex: 1,
  },

  emptyCard: {
    marginTop: 8,
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
});
