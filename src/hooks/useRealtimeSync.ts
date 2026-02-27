// src/hooks/useRealtimeSync.ts
import { useEffect } from 'react';
import { realtimeSync, type SyncCallback } from '../services/realtimeSync';

/**
 * A React Hook that connects a component to live database changes.
 * It automatically cleans up the subscription when the component unmounts.
 *
 * @param table The Supabase table to listen to (e.g., 'list_items')
 * @param callback The function to run when data changes
 */
export function useRealtimeSync<T = any>(table: string, callback: SyncCallback<T>): void {
  useEffect(() => {
    // Register the listener when the component mounts
    const unsubscribe = realtimeSync.onTableChange<T>(table, callback);

    // Cleanup the listener when the component unmounts (prevents memory leaks!)
    return () => {
      unsubscribe();
    };
  }, [table, callback]);
}
