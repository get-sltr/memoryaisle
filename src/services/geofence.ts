// Geofence Service - Auto-surface list when arriving at a store
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORES_KEY = 'memoryaisle_saved_stores';
const GEOFENCE_RADIUS = 100; // meters

export interface SavedStore {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

type ArrivalCallback = (store: SavedStore) => void;
type DepartureCallback = (store: SavedStore) => void;

class GeofenceService {
  private subscription: Location.LocationSubscription | null = null;
  private savedStores: SavedStore[] = [];
  private onArrival: ArrivalCallback | null = null;
  private onDeparture: DepartureCallback | null = null;
  private currentStoreId: string | null = null;
  private isMonitoring = false;

  // Calculate distance between two coordinates (Haversine formula)
  private getDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Load saved stores from storage
  async loadStores(): Promise<SavedStore[]> {
    try {
      const data = await AsyncStorage.getItem(STORES_KEY);
      this.savedStores = data ? JSON.parse(data) : [];
      return this.savedStores;
    } catch (error) {
      console.error('Failed to load stores:', error);
      return [];
    }
  }

  // Save a new store location
  async saveStore(store: Omit<SavedStore, 'id'>): Promise<SavedStore> {
    const newStore: SavedStore = {
      ...store,
      id: Date.now().toString(),
    };
    this.savedStores.push(newStore);
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(this.savedStores));
    return newStore;
  }

  // Save current location as a store
  async saveCurrentLocationAsStore(name: string): Promise<SavedStore | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Try to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const addressString = address
        ? `${address.street || ''} ${address.city || ''}`.trim()
        : undefined;

      return this.saveStore({
        name,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: addressString,
      });
    } catch (error) {
      console.error('Failed to save current location:', error);
      return null;
    }
  }

  // Remove a saved store
  async removeStore(storeId: string): Promise<void> {
    this.savedStores = this.savedStores.filter((s) => s.id !== storeId);
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(this.savedStores));
  }

  // Start monitoring location for store arrivals and departures
  async startMonitoring(
    onArrival: ArrivalCallback,
    onDeparture?: DepartureCallback
  ): Promise<boolean> {
    if (this.isMonitoring) return true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return false;
      }

      await this.loadStores();
      this.onArrival = onArrival;
      this.onDeparture = onDeparture || null;

      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50, // Update every 50 meters
          timeInterval: 30000, // Or every 30 seconds
        },
        (location) => {
          this.checkProximity(location.coords);
        }
      );

      this.isMonitoring = true;
      console.log('Geofence monitoring started');
      return true;
    } catch (error) {
      console.error('Failed to start geofence monitoring:', error);
      return false;
    }
  }

  // Check if user is near any saved store
  private checkProximity(coords: { latitude: number; longitude: number }) {
    let isInsideAnyStore = false;

    for (const store of this.savedStores) {
      const distance = this.getDistance(
        coords.latitude,
        coords.longitude,
        store.latitude,
        store.longitude
      );

      if (distance <= GEOFENCE_RADIUS) {
        isInsideAnyStore = true;
        // Only trigger arrival if we weren't already at this store
        if (this.currentStoreId !== store.id) {
          this.currentStoreId = store.id;
          console.log(`Arrived at ${store.name}`);
          this.onArrival?.(store);
        }
        return;
      }
    }

    // User is not inside any store - check if they just left
    if (this.currentStoreId && !isInsideAnyStore) {
      const leftStore = this.savedStores.find(
        (s) => s.id === this.currentStoreId
      );
      if (leftStore) {
        const distance = this.getDistance(
          coords.latitude,
          coords.longitude,
          leftStore.latitude,
          leftStore.longitude
        );
        // Trigger departure when user exits (past the radius)
        if (distance > GEOFENCE_RADIUS) {
          console.log(`Leaving ${leftStore.name}`);
          this.onDeparture?.(leftStore);
          this.currentStoreId = null;
        }
      }
    }
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isMonitoring = false;
    this.onArrival = null;
    console.log('Geofence monitoring stopped');
  }

  // Get all saved stores
  getStores(): SavedStore[] {
    return this.savedStores;
  }

  // Check if currently monitoring
  isActive(): boolean {
    return this.isMonitoring;
  }
}

export const geofenceService = new GeofenceService();
