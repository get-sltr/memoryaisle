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

interface ChannelSubscription {
  channel: RealtimeChannel;
  table: string;
  callbacks: Set<SyncCallback>;
}

class RealtimeSyncService {
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private userId: string | null = null;
  private familyId: string | null = null;
  private isConnected = false;

  // Initialize realtime sync for a user
  async initialize(userId: string, familyId?: string): Promise<void> {
    this.userId = userId;
    this.familyId = familyId || null;

    // Subscribe to core tables
    await this.subscribeToTable('lists');
    await this.subscribeToTable('list_items');
    await this.subscribeToTable('family_members');
    await this.subscribeToTable('notifications');

    if (familyId) {
      await this.subscribeToTable('family_activity');
    }

    this.isConnected = true;
    logger.log('Realtime sync initialized');
  }

  // Subscribe to a specific table
  private async subscribeToTable(table: string): Promise<void> {
    if (this.subscriptions.has(table)) {
      return;
    }

    const channelName = `${table}_${this.userId}`;

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
        if (status === 'SUBSCRIBED') {
          logger.log(`Subscribed to ${table} changes`);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`Error subscribing to ${table}`);
        }
      });

    this.subscriptions.set(table, {
      channel,
      table,
      callbacks: new Set(),
    });
  }

  // Get filter based on table and user context
  private getFilterForTable(table: string): string | undefined {
    switch (table) {
      case 'lists':
        return this.familyId
          ? `family_id=eq.${this.familyId}`
          : `user_id=eq.${this.userId}`;
      case 'list_items':
        // Items are filtered through list relationship
        return undefined;
      case 'family_members':
        return this.familyId
          ? `family_id=eq.${this.familyId}`
          : undefined;
      case 'notifications':
        return `user_id=eq.${this.userId}`;
      case 'family_activity':
        return this.familyId
          ? `family_id=eq.${this.familyId}`
          : undefined;
      default:
        return undefined;
    }
  }

  // Handle incoming change
  private handleChange(
    table: string,
    payload: RealtimePostgresChangesPayload<any>
  ): void {
    const subscription = this.subscriptions.get(table);
    if (!subscription) return;

    const event: SyncEvent = {
      type: payload.eventType as ChangeType,
      table,
      record: payload.new || payload.old,
      oldRecord: payload.eventType === 'UPDATE' ? payload.old : undefined,
      timestamp: new Date().toISOString(),
    };

    logger.log(`Realtime ${event.type} on ${table}:`, event.record?.id);

    // Notify all callbacks
    subscription.callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        logger.error('Error in sync callback:', error);
      }
    });
  }

  // Register a callback for table changes
  onTableChange<T = any>(table: string, callback: SyncCallback<T>): () => void {
    let subscription = this.subscriptions.get(table);

    if (!subscription) {
      // Auto-subscribe to the table
      this.subscribeToTable(table);
      subscription = this.subscriptions.get(table);
    }

    if (subscription) {
      subscription.callbacks.add(callback as SyncCallback);
    }

    // Return unsubscribe function
    return () => {
      subscription?.callbacks.delete(callback as SyncCallback);
    };
  }

  // Subscribe to list changes
  onListChange(callback: SyncCallback): () => void {
    return this.onTableChange('lists', callback);
  }

  // Subscribe to list item changes
  onItemChange(callback: SyncCallback): () => void {
    return this.onTableChange('list_items', callback);
  }

  // Subscribe to family member changes
  onFamilyChange(callback: SyncCallback): () => void {
    return this.onTableChange('family_members', callback);
  }

  // Subscribe to notifications
  onNotification(callback: SyncCallback): () => void {
    return this.onTableChange('notifications', callback);
  }

  // Broadcast a custom event to family members
  async broadcastToFamily(eventType: string, payload: any): Promise<void> {
    if (!this.familyId) return;

    const channel = supabase.channel(`family_${this.familyId}`);

    await channel.send({
      type: 'broadcast',
      event: eventType,
      payload: {
        ...payload,
        senderId: this.userId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Subscribe to family broadcasts
  onFamilyBroadcast(eventType: string, callback: (payload: any) => void): () => void {
    if (!this.familyId) return () => {};

    const channel = supabase
      .channel(`family_${this.familyId}`)
      .on('broadcast', { event: eventType }, ({ payload }) => {
        // Don't process our own broadcasts
        if (payload.senderId !== this.userId) {
          callback(payload);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  // Presence tracking for family members
  async trackPresence(): Promise<RealtimeChannel | null> {
    if (!this.familyId) return null;

    const channel = supabase.channel(`presence_${this.familyId}`);

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: this.userId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return channel;
  }

  // Get online family members
  onPresenceChange(callback: (users: any[]) => void): () => void {
    if (!this.familyId) return () => {};

    const channel = supabase
      .channel(`presence_${this.familyId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat();
        callback(users);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  // Update family context
  setFamilyId(familyId: string | null): void {
    const wasFamily = this.familyId;
    this.familyId = familyId;

    // Resubscribe to family-specific channels if changed
    if (wasFamily !== familyId && this.isConnected) {
      this.subscriptions.forEach((sub) => {
        sub.channel.unsubscribe();
      });
      this.subscriptions.clear();

      if (this.userId) {
        this.initialize(this.userId, familyId || undefined);
      }
    }
  }

  // Disconnect and cleanup
  disconnect(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.channel.unsubscribe();
    });
    this.subscriptions.clear();
    this.isConnected = false;
    this.userId = null;
    this.familyId = null;
    logger.log('Realtime sync disconnected');
  }

  // Check connection status
  getStatus(): { connected: boolean; subscriptions: string[] } {
    return {
      connected: this.isConnected,
      subscriptions: Array.from(this.subscriptions.keys()),
    };
  }
}

export const realtimeSync = new RealtimeSyncService();

// React hook for realtime sync
export function useRealtimeSync<T = any>(
  table: string,
  callback: SyncCallback<T>
): void {
  // This would be implemented as a proper React hook using useEffect
  // For now, it's a placeholder that would be properly implemented in a hooks file
}
