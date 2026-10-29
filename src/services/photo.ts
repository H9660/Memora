import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PhotoData = {
  uri: string;
  capturedAt: string; // ISO-8601 time the photo was taken
};

export class CameraPermissionError extends Error {}

// Opens the camera. Returns null when the user cancels. Throws
// CameraPermissionError when camera permission is denied.
export async function capturePhoto(): Promise<PhotoData | null> {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) {
    throw new CameraPermissionError('Camera permission was denied.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled) {
    return null;
  }

  return {
    uri: result.assets[0].uri,
    capturedAt: new Date().toISOString(),
  };
}

// The camera writes to a cache folder that Android may clear, so copy the
// photo into the app's own storage before saving a memory that points to it.
export async function persistPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    return uri;
  }

  const directory = new Directory(Paths.document, 'photos');
  directory.create({ intermediates: true, idempotent: true });

  const destination = new File(directory, `${Crypto.randomUUID()}.jpg`);
  await new File(uri).copy(destination);
  return destination.uri;
}

export function deletePhoto(uri: string): void {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.log('Deleting photo failed:', error);
  }
}
