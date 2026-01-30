// Geofence Service - Auto-surface list when arriving at a store
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { StoreLocation } from '../types';

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

// Map a Supabase StoreLocation row to the local SavedStore shape
function toSavedStore(row: StoreLocation): SavedStore {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
  };
}

class GeofenceService {
  private subscription: Location.LocationSubscription | null = null;
  private savedStores: SavedStore[] = [];
  private onArrival: ArrivalCallback | null = null;
  private onDeparture: DepartureCallback | null = null;
  private currentStoreId: string | null = null;
  private isMonitoring = false;
  private householdId: string | null = null;

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

  // Load saved stores from Supabase
  async loadStores(householdId: string): Promise<SavedStore[]> {
    try {
      const { data, error } = await supabase
        .from('store_locations')
        .select('*')
        .eq('household_id', householdId);

      if (error) throw error;

      this.savedStores = (data as StoreLocation[]).map(toSavedStore);
      return this.savedStores;
    } catch (error) {
      logger.error('Failed to load stores:', error);
      return [];
    }
  }

  // Save a new store location to Supabase
  async saveStore(
    householdId: string,
    store: Omit<SavedStore, 'id'>
  ): Promise<SavedStore | null> {
    try {
      const { data, error } = await supabase
        .from('store_locations')
        .insert({
          household_id: householdId,
          name: store.name,
          latitude: store.latitude,
          longitude: store.longitude,
          address: store.address || null,
          geofence_radius_meters: GEOFENCE_RADIUS,
        })
        .select()
        .single();

      if (error) throw error;

      const saved = toSavedStore(data as StoreLocation);
      this.savedStores.push(saved);
      return saved;
    } catch (error) {
      logger.error('Failed to save store:', error);
      return null;
    }
  }

  // Save current location as a store
  async saveCurrentLocationAsStore(
    householdId: string,
    name: string
  ): Promise<SavedStore | null> {
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

      return this.saveStore(householdId, {
        name,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: addressString,
      });
    } catch (error) {
      logger.error('Failed to save current location:', error);
      return null;
    }
  }

  // Remove a saved store from Supabase
  async removeStore(storeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('store_locations')
        .delete()
        .eq('id', storeId);

      if (error) throw error;

      this.savedStores = this.savedStores.filter((s) => s.id !== storeId);
    } catch (error) {
      logger.error('Failed to remove store:', error);
    }
  }

  // Start monitoring location for store arrivals and departures
  async startMonitoring(
    householdId: string,
    onArrival: ArrivalCallback,
    onDeparture?: DepartureCallback
  ): Promise<boolean> {
    if (this.isMonitoring) return true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.log('Location permission denied');
        return false;
      }

      this.householdId = householdId;
      await this.loadStores(householdId);
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
      logger.log('Geofence monitoring started');
      return true;
    } catch (error) {
      logger.error('Failed to start geofence monitoring:', error);
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
          logger.log(`Arrived at ${store.name}`);
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
          logger.log(`Leaving ${leftStore.name}`);
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
    this.householdId = null;
    logger.log('Geofence monitoring stopped');
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
