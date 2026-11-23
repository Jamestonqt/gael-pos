import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncState, Product, Sale, UtangCustomer, UtangTransaction, WalletLog } from '../types';
import { posDb } from './indexedDb';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-supabase-url')) {
    return null;
  }

  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.warn('Error creating Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-supabase-url') &&
    SUPABASE_URL.startsWith('http')
  );
}

export async function checkNetworkAndSyncStatus(): Promise<SyncState> {
  if (!isSupabaseConfigured()) {
    return 'local-only';
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline-mode';
  }

  const client = getSupabaseClient();
  if (!client) {
    return 'local-only';
  }

  try {
    // Quick ping to check connection
    const { error } = await client.from('products').select('id').limit(1);
    if (error) {
      console.warn('Supabase ping check returned error:', error.message);
      return 'offline-mode';
    }
    return 'online-synced';
  } catch {
    return 'offline-mode';
  }
}

/**
 * Pushes unsynced changes to Supabase and pulls remote changes
 */
export async function syncWithSupabase(): Promise<{
  success: boolean;
  message: string;
  syncedCount: number;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: true,
      message: 'Running in Local-Only Mode (Supabase URL not configured). All data is safe in IndexedDB.',
      syncedCount: 0,
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      message: 'Cannot sync: You are currently offline. Changes are saved locally and will sync when reconnected.',
      syncedCount: 0,
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase client failed to initialize.',
      syncedCount: 0,
    };
  }

  try {
    let syncedCount = 0;
    const queue = await posDb.getSyncQueue();

    // 1. Flush offline sync queue
    for (const item of queue) {
      try {
        if (item.action === 'insert' || item.action === 'update') {
          const { error } = await client.from(item.table).upsert(item.data);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await client.from(item.table).delete().eq('id', item.data.id);
          if (error) throw error;
        }
        await posDb.clearSyncQueueItem(item.id);
        syncedCount++;
      } catch (err: any) {
        console.warn(`Failed to sync queue item ${item.id} to ${item.table}:`, err?.message);
      }
    }

    // 2. Fetch remote products to sync locally
    try {
      const { data: remoteProducts, error: prodErr } = await client.from('products').select('*');
      if (!prodErr && remoteProducts && remoteProducts.length > 0) {
        for (const rp of remoteProducts) {
          await posDb.put('products', rp);
        }
      }
    } catch (e) {
      console.warn('Error pulling remote products:', e);
    }

    // 3. Fetch remote utang_customers
    try {
      const { data: remoteCustomers, error: custErr } = await client.from('utang_customers').select('*');
      if (!custErr && remoteCustomers && remoteCustomers.length > 0) {
        for (const rc of remoteCustomers) {
          await posDb.put('utang_customers', rc);
        }
      }
    } catch (e) {
      console.warn('Error pulling remote customers:', e);
    }

    return {
      success: true,
      message: `Sync complete! Synced ${syncedCount} queued change(s).`,
      syncedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Sync failed: ${err?.message || 'Network error'}`,
      syncedCount: 0,
    };
  }
}
