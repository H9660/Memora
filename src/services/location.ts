import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type LocationData = {
  latitude: number;
  longitude: number;
  placeName: string | null;
  capturedAt: string; // ISO-8601 time of the GPS fix
};

// Returns null when permission is denied (or not yet granted, when
// requestPermission is false). Throws when location is unavailable
// (e.g. location services turned off).
export async function getCurrentLocation({
  requestPermission = true,
}: { requestPermission?: boolean } = {}): Promise<LocationData | null> {
  const { status } = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();

  if (status !== 'granted') {
    return null;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    // Only prompt to change location settings when the user is capturing,
    // not when Home just reads the current context.
    mayShowUserSettingsDialog: requestPermission,
  });

  const { latitude, longitude } = location.coords;

  return {
    latitude,
    longitude,
    placeName: await lookUpPlaceName(latitude, longitude),
    capturedAt: new Date(location.timestamp).toISOString(),
  };
}

async function lookUpPlaceName(latitude: number, longitude: number): Promise<string | null> {
  // Reverse geocoding is Android/iOS only; on web it just warns and returns
  // nothing, so callers show coordinates instead.
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses.length > 0) {
      const address = addresses[0];

      return (
        address.name ||
        address.street ||
        address.district ||
        address.city ||
        null
      );
    }
  } catch (error) {
    console.log('Reverse geocoding failed:', error);
  }

  return null;
}