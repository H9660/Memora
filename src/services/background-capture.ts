import * as Location from 'expo-location';
import { PermissionsAndroid, Platform } from 'react-native';

import { DayActivity, startOfLocalDay, summarizeDay } from '@/domain/captured-activity';

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
  return (
    MemoraSensing?.getStatus(startOfLocalDay(new Date()).getTime()) ?? {
      running: false,
      startedAt: null,
      counts: {},
      lastSampleAt: {},
      latestPhotoUri: null,
      latestSoundLabels: [],
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

  // Optional permissions: capture still runs if they are denied, just without
  // photos or sound labels, or with the notification hidden (Android 13+).
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  await MemoraSensing.startCapture();
}

export function stopCapture(): void {
  MemoraSensing?.stopCapture();
}

// Everything captured on the given day (local midnight to midnight), by hour.
export async function getCapturedDay(day: Date): Promise<DayActivity> {
  const start = startOfLocalDay(day);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const samples = MemoraSensing ? await MemoraSensing.getSamples(start.getTime(), end.getTime()) : [];
  return summarizeDay(samples);
}
