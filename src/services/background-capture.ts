import * as Location from 'expo-location';
import { PermissionsAndroid, Platform } from 'react-native';

import MemoraSensing, { CaptureStatus } from '../../modules/memora-sensing';

export type { CaptureStatus, CaptureStream } from '../../modules/memora-sensing';

// 'needs-rebuild': running in Expo Go or a development build made before the
// native capture module was added.
export type CaptureAvailability = 'available' | 'unsupported' | 'needs-rebuild';

export class CapturePermissionError extends Error {}

export function getCaptureAvailability(): CaptureAvailability {
  if (Platform.OS !== 'android') {
    return 'unsupported';
  }
  return MemoraSensing ? 'available' : 'needs-rebuild';
}

// Counts cover today (since local midnight).
export function getCaptureStatus(): CaptureStatus {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  return (
    MemoraSensing?.getStatus(midnight.getTime()) ?? {
      running: false,
      startedAt: null,
      counts: {},
      lastSampleAt: {},
    }
  );
}

// Call from a button press: Android only lets the capture service start while
// Memora is on screen.
export async function startCapture(): Promise<void> {
  if (!MemoraSensing) {
    throw new Error('Background capture is not available in this build.');
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new CapturePermissionError('Location permission is needed for background capture.');
  }

  // Android 13+ hides the capture notification without this permission.
  // Capture still works if it is denied, so the result is not checked.
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  await MemoraSensing.startCapture();
}

export function stopCapture(): void {
  MemoraSensing?.stopCapture();
}
