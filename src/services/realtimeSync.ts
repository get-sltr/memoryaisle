// Realtime Sync Service
// Handles Supabase realtime subscriptions for live updates

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncEvent<T = any> {
  type: ChangeType;
  table: string;
  record: T;
  oldRecord?: T;
  timestamp: string;
}

export type SyncCallback<T = any> = (event: SyncEvent<T>) => void;
export type BroadcastCallback = (payload: any) => void;
export type PresenceCallback = (users: any[]) => void;

interface ChannelSubscription {
  channel: RealtimeChannel;
  table: string;
  callbacks: Set<SyncCallback>;
}

class RealtimeSyncService {
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private familyChannel: RealtimeChannel | null = null;
  
  private broadcastCallbacks: Map<string, Set<BroadcastCallback>> = new Map();
  private presenceCallbacks: Set<PresenceCallback> = new Set();
  
  private userId: string | null = null;
  private familyId: string | null = null;
  private isConnected = false;

  // Initialize realtime sync for a user
  async initialize(userId: string, familyId?: string): Promise<void> {
    this.userId = userId;
    this.familyId = familyId || null;

    // 1. Subscribe to core table changes
    this.subscribeToTable('grocery_lists');
    this.subscribeToTable('list_items');
    this.subscribeToTable('family_members');
    this.subscribeToTable('notifications');

    if (this.familyId) {
      this.subscribeToTable('family_activity');
      this.setupSharedFamilyChannel();
    }

    this.isConnected = true;
    logger.info('Realtime sync initialized');
  }

  // Set up a single multiplexed channel for ALL family broadcasts & presence
  private setupSharedFamilyChannel() {
    if (!this.familyId || !this.userId) return;

    // Clean up existing channel if re-initializing
    if (this.familyChannel) {
      this.familyChannel.unsubscribe();
    }

    this.familyChannel = supabase.channel(`family_shared_${this.familyId}`);

    // Listen for all broadcasts
    this.familyChannel.on('broadcast', { event: '*' }, ({ event, payload }) => {
      if (payload.senderId !== this.userId) {
        const callbacks = this.broadcastCallbacks.get(event);
        callbacks?.forEach(cb => cb(payload));
      }
    });

    // Listen for presence syncs
    this.familyChannel.on('presence', { event: 'sync' }, () => {
      if (!this.familyChannel) return;
      const state = this.familyChannel.presenceState();
      const users = Object.values(state).flat();
      this.presenceCallbacks.forEach(cb => cb(users));
    });

    this.familyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.familyChannel?.track({
          id: this.userId,
          online_at: new Date().toISOString(),
        });
      }
    });
  }

  // Subscribe to a specific Postgres table
  private subscribeToTable(table: string, retryCount = 0): void {
    if (this.subscriptions.has(table)) return;

    const channelName = `table_${table}_${this.userId || 'anon'}_${Date.now()}`;
    const callbacks = new Set<SyncCallback>();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: this.getFilterForTable(table),
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleChange(table, payload);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn(`Realtime ${status} for ${table} (attempt ${retryCount + 1})`);
          // Clean up failed channel and retry with backoff (max 3 attempts)
          if (retryCount < 3) {
            channel.unsubscribe();
            this.subscriptions.delete(table);
            const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
            setTimeout(() => this.subscribeToTable(table, retryCount + 1), delay);
          } else {
            logger.error(`Realtime: gave up subscribing to ${table} after ${retryCount + 1} attempts`);
          }
        }
      });

    // Set synchronously to avoid race conditions
    this.subscriptions.set(table, { channel, table, callbacks });
  }

  private getFilterForTable(table: string): string | undefined {
    switch (table) {
      case 'grocery_lists':
      case 'family_members':
      case 'family_activity':
        return this.familyId ? `household_id=eq.${this.familyId}` : undefined;
      case 'notifications':
        return this.userId ? `user_id=eq.${this.userId}` : undefined;
      case 'list_items':
        return undefined; // Items filtered via RLS
      default:
        return undefined;
    }
  }

  private handleChange(table: string, payload: RealtimePostgresChangesPayload<any>): void {
    const subscription = this.subscriptions.get(table);
    if (!subscription) return;

    const event: SyncEvent = {
      type: payload.eventType as ChangeType,
      table,
      record: payload.eventType === 'DELETE' ? payload.old : payload.new,
      oldRecord: payload.eventType === 'UPDATE' ? payload.old : undefined,
      timestamp: new Date().toISOString(),
    };

    subscription.callbacks.forEach((callback) => {
      try { callback(event); } catch (error) { logger.error('Sync callback error:', error); }
    });
  }

  // Register a callback for table changes
  onTableChange<T = any>(table: string, callback: SyncCallback<T>): () => void {
    if (!this.subscriptions.has(table)) {
      this.subscribeToTable(table);
    }

    const subscription = this.subscriptions.get(table);
    subscription?.callbacks.add(callback as SyncCallback);

    return () => {
      subscription?.callbacks.delete(callback as SyncCallback);
    };
  }

  // Convenience Methods
  onListChange(callback: SyncCallback): () => void { return this.onTableChange('grocery_lists', callback); }
  onItemChange(callback: SyncCallback): () => void { return this.onTableChange('list_items', callback); }
  onFamilyChange(callback: SyncCallback): () => void { return this.onTableChange('family_members', callback); }
  onNotification(callback: SyncCallback): () => void { return this.onTableChange('notifications', callback); }

  // --- Broadcast & Presence Methods ---

  async broadcastToFamily(eventType: string, payload: any): Promise<void> {
    if (!this.familyChannel) return;
    await this.familyChannel.send({
      type: 'broadcast',
      event: eventType,
      payload: { ...payload, senderId: this.userId, timestamp: new Date().toISOString() },
    });
  }

  onFamilyBroadcast(eventType: string, callback: BroadcastCallback): () => void {
    if (!this.broadcastCallbacks.has(eventType)) {
      this.broadcastCallbacks.set(eventType, new Set());
    }
    const callbacks = this.broadcastCallbacks.get(eventType)!;
    callbacks.add(callback);

    return () => callbacks.delete(callback);
  }

  onPresenceChange(callback: PresenceCallback): () => void {
    this.presenceCallbacks.add(callback);
    // Immediately fire with current state if available
    if (this.familyChannel) {
      const state = this.familyChannel.presenceState();
      callback(Object.values(state).flat());
    }
    return () => this.presenceCallbacks.delete(callback);
  }

  // Update family context
  setFamilyId(familyId: string | null): void {
    const wasFamily = this.familyId;
    this.familyId = familyId;

    if (wasFamily !== familyId && this.isConnected && this.userId) {
      this.disconnect();
      this.initialize(this.userId, familyId || undefined);
    }
  }

  // Disconnect and cleanup
  disconnect(): void {
    this.subscriptions.forEach((sub) => sub.channel.unsubscribe());
    this.subscriptions.clear();
    
    if (this.familyChannel) {
      this.familyChannel.unsubscribe();
      this.familyChannel = null;
    }
    
    this.broadcastCallbacks.clear();
    this.presenceCallbacks.clear();
    this.isConnected = false;
    this.userId = null;
    this.familyId = null;
    logger.info('Realtime sync disconnected');
  }

  getStatus(): { connected: boolean; subscriptions: string[] } {
    return {
      connected: this.isConnected,
      subscriptions: Array.from(this.subscriptions.keys()),
    };
  }
}

export const realtimeSync = new RealtimeSyncService();