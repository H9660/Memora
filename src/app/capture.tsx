import { StyleSheet, Text, View, Pressable, TextInput, ScrollView } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { getCurrentLocation, LocationData } from "@/services/location";
import {
  CameraPermissionError,
  capturePhoto,
  deletePhoto,
  persistPhoto,
  PhotoData,
} from "@/services/photo";
import { createMemoryEvent, MemoryValidationError } from "@/domain/memory-event";
import { useMemoryRepository } from "@/hooks/use-memory-repository";

export default function CaptureScreen() {
  const repository = useMemoryRepository();
  const [capturedAt] = useState(() => new Date());
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationStatus, setLocationStatus] = useState("Detecting...");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLocation() {
      try {
        const result = await getCurrentLocation();
        if (!active) return;

        if (result) {
          setLocation(result);
          setLocationStatus(
            result.placeName ??
              `${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`,
          );
        } else {
          setLocationStatus("Permission denied (you can still save)");
        }
      } catch {
        if (active) {
          setLocationStatus("Unavailable — is location turned on?");
        }
      }
    }

    loadLocation();
    return () => {
      active = false;
    };
  }, []);

  async function handleTakePhoto() {
    setPhotoMessage(null);

    try {
      const result = await capturePhoto();
      if (result) {
        setPhoto(result);
      }
    } catch (e) {
      setPhotoMessage(
        e instanceof CameraPermissionError
          ? "Camera permission denied (you can still save without a photo)"
          : "Couldn't open the camera.",
      );
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);

    let savedPhotoUri: string | undefined;
    try {
      // Validate before copying the photo, so a rejected note leaves no file behind.
      createMemoryEvent({ note, capturedAt });

      const savedPhoto = photo
        ? { uri: await persistPhoto(photo.uri), capturedAt: photo.capturedAt }
        : undefined;
      savedPhotoUri = savedPhoto?.uri;

      const event = createMemoryEvent({
        note,
        capturedAt,
        location: location ?? undefined,
        photo: savedPhoto,
      });
      await repository.create(event);
      router.back();
    } catch (e) {
      if (savedPhotoUri) {
        deletePhoto(savedPhotoUri);
      }
      setError(
        e instanceof MemoryValidationError
          ? e.message
          : "Couldn't save this memory. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Remember This</Text>

      <Text style={styles.subtitle}>
        Capture something you want to remember.
      </Text>

      <View style={styles.contextCard}>
        <Text style={styles.contextTitle}>Current Context</Text>

        <Text style={styles.contextText}>📍 Location: {locationStatus}</Text>
        <Text style={styles.contextText}>
          🕐 Time:{" "}
          {capturedAt.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </Text>
      </View>

      {photo ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />

          <View style={styles.photoActions}>
            <Pressable onPress={handleTakePhoto}>
              <Text style={styles.photoAction}>Retake</Text>
            </Pressable>
            <Pressable onPress={() => setPhoto(null)}>
              <Text style={styles.photoAction}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.photoButton} onPress={handleTakePhoto}>
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={styles.photoText}>Take a Photo</Text>
          <Text style={styles.photoHint}>Optional</Text>
        </Pressable>
      )}

      {photoMessage && <Text style={styles.hint}>{photoMessage}</Text>}

      <Text style={styles.label}>What is happening?</Text>

      <TextInput
        style={styles.input}
        placeholder="Describe this moment..."
        placeholderTextColor="#9CA3AF"
        multiline
        value={note}
        onChangeText={setNote}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? "SAVING..." : "SAVE MEMORY"}</Text>
      </Pressable>
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

  contextCard: {
    marginTop: 28,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
  },

  contextTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  contextText: {
    fontSize: 14,
    color: "#555B66",
    marginTop: 7,
  },

  photoButton: {
    height: 120,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: "#E9EBEF",
    alignItems: "center",
    justifyContent: "center",
  },

  photoIcon: {
    fontSize: 32,
  },

  photoText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
  },

  photoHint: {
    marginTop: 2,
    fontSize: 12,
    color: "#777E89",
  },

  photoPreview: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  photoImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },

  photoActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
  },

  photoAction: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1B1D22",
  },

  hint: {
    marginTop: 8,
    fontSize: 13,
    color: "#777E89",
  },

  label: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "700",
  },

  input: {
    minHeight: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    textAlignVertical: "top",
  },

  error: {
    marginTop: 12,
    fontSize: 14,
    color: "#B42318",
  },

  saveButton: {
    marginTop: 20,
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: "#1B1D22",
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
