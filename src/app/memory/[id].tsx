import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { EvidenceType, isUserProvided } from "@/domain/evidence";
import {
  applyMemoryEdits,
  formatPlace,
  getPhotoUri,
  MemoryEvent,
  MemoryValidationError,
} from "@/domain/memory-event";
import { useMemoryRepository } from "@/hooks/use-memory-repository";
import { deletePhoto } from "@/services/photo";

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  USER_NOTE: "Note",
  SELF_REPORT: "Self-report",
  LOCATION: "Location",
  PHOTO: "Photo",
  MOTION: "Motion",
  AUDIO_TRANSCRIPT: "Audio transcript",
  CALENDAR: "Calendar",
  BLUETOOTH: "Bluetooth",
  WEARABLE: "Wearable",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repository = useMemoryRepository();
  // undefined while loading, null when not found
  const [memory, setMemory] = useState<MemoryEvent | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [removeLocation, setRemoveLocation] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    repository
      .getById(id)
      .then((result) => {
        if (active) setMemory(result);
      })
      .catch(() => {
        if (active) {
          setMemory(null);
          setError("Couldn't load this memory.");
        }
      });

    return () => {
      active = false;
    };
  }, [id, repository]);

  if (memory === undefined) {
    return <View style={styles.container} />;
  }

  if (memory === null) {
    return (
      <View style={[styles.container, styles.content]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Memory not found</Text>
        <Text style={styles.subtitle}>
          {error ?? "It may have been deleted."}
        </Text>
      </View>
    );
  }

  const current = memory;
  const photoUri = getPhotoUri(current);
  const captured = new Date(current.capturedAt);

  function startEditing() {
    setDraftNote(current.note);
    setRemoveLocation(false);
    setRemovePhoto(false);
    setError(null);
    setEditing(true);
  }

  async function saveEdits() {
    setError(null);
    setBusy(true);

    try {
      const updated = applyMemoryEdits(current, {
        note: draftNote,
        removeLocation,
        removePhoto,
      });
      await repository.update(updated);
      if (removePhoto && photoUri) {
        deletePhoto(photoUri);
      }
      setMemory(updated);
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof MemoryValidationError
          ? e.message
          : "Couldn't save your changes. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteMemory() {
    setBusy(true);

    try {
      await repository.delete(current.id);
      if (photoUri) {
        deletePhoto(photoUri);
      }
      router.back();
    } catch {
      setError("Couldn't delete this memory. Please try again.");
      setBusy(false);
    }
  }

  function confirmDelete() {
    const message = "This memory and its evidence will be permanently deleted.";

    // Alert buttons don't work on web.
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(message)) deleteMemory();
      return;
    }

    Alert.alert("Delete memory?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: deleteMemory },
    ]);
  }

  const showPhoto = photoUri && !(editing && removePhoto);
  const showLocation = current.location && !(editing && removeLocation);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>
        {captured.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Text>
      <Text style={styles.subtitle}>
        {captured.toLocaleDateString(undefined, { year: "numeric" })} ·{" "}
        {captured.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>

      {showPhoto && (
        <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
      )}

      <Text style={styles.sectionTitle}>YOU WROTE</Text>
      <View style={styles.card}>
        {editing ? (
          <TextInput
            style={styles.input}
            value={draftNote}
            onChangeText={setDraftNote}
            multiline
            autoFocus
          />
        ) : (
          <Text style={styles.note}>{current.note}</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>FROM YOUR PHONE</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>
          🕐 Recorded {formatDateTime(current.capturedAt)}
        </Text>
        {showLocation && current.location ? (
          <>
            <Text style={styles.cardText}>📍 {formatPlace(current.location)}</Text>
            <Text style={styles.cardHint}>
              {current.location.latitude.toFixed(5)},{" "}
              {current.location.longitude.toFixed(5)} · where your phone was,
              not proof of what happened there
            </Text>
          </>
        ) : (
          <Text style={styles.cardText}>📍 No location saved</Text>
        )}
        {showPhoto && <Text style={styles.cardText}>📷 Photo attached</Text>}
      </View>

      {editing && (current.location || photoUri) && (
        <View style={styles.card}>
          {current.location && (
            <Toggle
              label="Remove location"
              value={removeLocation}
              onChange={setRemoveLocation}
            />
          )}
          {photoUri && (
            <Toggle label="Remove photo" value={removePhoto} onChange={setRemovePhoto} />
          )}
        </View>
      )}

      {!editing && (
        <>
          <Text style={styles.sectionTitle}>EVIDENCE</Text>
          <View style={styles.card}>
            {current.evidence.map((item) => (
              <View key={item.id} style={styles.evidenceRow}>
                <Text style={styles.evidenceLabel}>
                  {EVIDENCE_LABELS[item.type]}
                  <Text style={styles.evidenceSource}>
                    {isUserProvided(item.type) ? "  · from you" : "  · from your phone"}
                  </Text>
                </Text>
                <Text style={styles.cardHint}>
                  {item.sourceDescription} · {formatDateTime(item.capturedAt)}
                </Text>
              </View>
            ))}
          </View>

          {current.updatedAt !== current.createdAt && (
            <Text style={styles.edited}>
              Edited {formatDateTime(current.updatedAt)}
            </Text>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {editing ? (
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setEditing(false)}
            disabled={busy}
          >
            <Text style={styles.secondaryButtonText}>CANCEL</Text>
          </Pressable>
          <Pressable
            style={[styles.button, busy && styles.disabled]}
            onPress={saveEdits}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{busy ? "SAVING..." : "SAVE"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.dangerButton, busy && styles.disabled]}
            onPress={confirmDelete}
            disabled={busy}
          >
            <Text style={styles.dangerButtonText}>DELETE</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={startEditing} disabled={busy}>
            <Text style={styles.buttonText}>EDIT</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      style={styles.toggle}
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <Text style={styles.toggleBox}>{value ? "☑" : "☐"}</Text>
      <Text style={styles.cardText}>{label}</Text>
    </Pressable>
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
    fontSize: 28,
    fontWeight: "800",
    color: "#1B1D22",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: "#6B7280",
  },

  photo: {
    marginTop: 24,
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },

  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#777E89",
    letterSpacing: 1,
  },

  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },

  note: {
    fontSize: 17,
    lineHeight: 24,
    color: "#1B1D22",
  },

  input: {
    minHeight: 100,
    fontSize: 17,
    lineHeight: 24,
    color: "#1B1D22",
    textAlignVertical: "top",
  },

  cardText: {
    fontSize: 15,
    color: "#1B1D22",
  },

  cardHint: {
    fontSize: 13,
    color: "#777E89",
  },

  evidenceRow: {
    gap: 2,
  },

  evidenceLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1B1D22",
  },

  evidenceSource: {
    fontWeight: "400",
    color: "#777E89",
  },

  edited: {
    marginTop: 12,
    fontSize: 13,
    color: "#777E89",
  },

  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },

  toggleBox: {
    fontSize: 20,
  },

  error: {
    marginTop: 16,
    fontSize: 14,
    color: "#B42318",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },

  button: {
    flex: 1,
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

  secondaryButton: {
    backgroundColor: "#E9EBEF",
  },

  secondaryButtonText: {
    color: "#1B1D22",
    fontSize: 15,
    fontWeight: "700",
  },

  dangerButton: {
    backgroundColor: "#FDECEA",
  },

  dangerButtonText: {
    color: "#B42318",
    fontSize: 15,
    fontWeight: "700",
  },

  disabled: {
    opacity: 0.6,
  },
});
