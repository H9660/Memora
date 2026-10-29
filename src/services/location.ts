import * as Location from 'expo-location';

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
  });

  const { latitude, longitude } = location.coords;

  let placeName: string | null = null;

  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses.length > 0) {
      const address = addresses[0];

      placeName =
        address.name ||
        address.street ||
        address.district ||
        address.city ||
        null;
    }
  } catch (error) {
    console.log('Reverse geocoding failed:', error);
  }

  return {
    latitude,
    longitude,
    placeName,
    capturedAt: new Date(location.timestamp).toISOString(),
  };
}