import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>MEMORA</Text>

      <Text style={styles.subtitle}>Your personal memory companion</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Current Context</Text>

        <Text style={styles.statusText}>📍 Location: Detecting...</Text>
        <Text style={styles.statusText}>🚶 Activity: Detecting...</Text>
      </View>

      <Text style={styles.sectionTitle}>TODAY</Text>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No memories yet</Text>

        <Text style={styles.emptyText}>
          Memories you capture will appear here.
        </Text>
      </View>

      <Pressable style={styles.button} onPress={() => router.push("/capture")}>
        <Text style={styles.buttonText}>+ REMEMBER THIS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: "#F7F8FA",
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

  sectionTitle: {
    marginTop: 30,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#777E89",
    letterSpacing: 1,
  },

  emptyCard: {
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
    marginTop: 24,
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
