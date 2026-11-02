import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  CapturePermissionError,
  getCaptureAvailability,
  getCaptureStatus,
  startCapture,
  stopCapture,
} from "@/services/background-capture";

export default function BackgroundCaptureScreen() {
  const availability = getCaptureAvailability();
  const [status, setStatus] = useState(getCaptureStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The service starts and stops asynchronously (and can be stopped from its
  // notification), so poll while this screen is visible.
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => setStatus(getCaptureStatus()), 1000);
      return () => clearInterval(timer);
    }, []),
  );

  async function handleToggle() {
    setMessage(null);

    if (status.running) {
      stopCapture();
      return;
    }

    setBusy(true);
    try {
      await startCapture();
    } catch (e) {
      setMessage(
        e instanceof CapturePermissionError
          ? e.message
          : "Couldn't start capture. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const since =
    status.startedAt &&
    new Date(status.startedAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Background Capture</Text>
      <Text style={styles.subtitle}>
        Records your day while the phone is in your chest pouch.
      </Text>

      {availability === "available" ? (
        <>
          <Pressable
            style={[
              styles.toggle,
              status.running ? styles.toggleOn : styles.toggleOff,
              busy && styles.disabled,
            ]}
            onPress={handleToggle}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={status.running ? "Stop capture" : "Start capture"}
          >
            <Text style={styles.toggleIcon}>{status.running ? "■" : "▶"}</Text>
            <Text style={styles.toggleText}>
              {status.running ? "STOP" : busy ? "STARTING..." : "START"}
            </Text>
          </Pressable>

          <Text style={styles.status}>
            {status.running ? `Capturing since ${since}` : "Not capturing"}
          </Text>

          {message && <Text style={styles.error}>{message}</Text>}
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {availability === "unsupported"
              ? "Android only"
              : "A new development build is needed"}
          </Text>
          <Text style={styles.cardText}>
            {availability === "unsupported"
              ? "Background capture uses Android features that aren't available here."
              : "Background capture uses native code that Expo Go and older builds don't include. Rebuild with: npx expo run:android"}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What is captured</Text>
        <Text style={styles.cardText}>
          The capture service runs with the screen off and shows a notification
          while it is on. Location, motion, photos and sound labels are being
          added step by step. Sound is never recorded or kept — only labels like
          “speech” or “traffic”.
        </Text>
        <Text style={styles.cardHint}>
          Stop any time here or from the notification.
        </Text>
      </View>
    </ScrollView>
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

  toggle: {
    alignSelf: "center",
    marginTop: 40,
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  toggleOff: {
    backgroundColor: "#1B1D22",
  },

  toggleOn: {
    backgroundColor: "#B42318",
  },

  toggleIcon: {
    fontSize: 40,
    color: "#FFFFFF",
  },

  toggleText: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },

  status: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 15,
    color: "#555B66",
  },

  error: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 14,
    color: "#B42318",
  },

  card: {
    marginTop: 32,
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
    color: "#555B66",
  },

  cardHint: {
    fontSize: 13,
    color: "#777E89",
  },

  disabled: {
    opacity: 0.6,
  },
});
