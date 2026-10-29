import * as Location from 'expo-location';

export type LocationData = {
  latitude: number;
  longitude: number;
  placeName: string | null;
};

export async function getCurrentLocation(): Promise<LocationData | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();

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
  };
}