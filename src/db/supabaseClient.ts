import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncState, Product, Sale, UtangCustomer, UtangTransaction, WalletLog } from '../types';
import { posDb } from './indexedDb';
import { DEMO_PRODUCT_IDS } from './seedData';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hvowxzerhlwbbmywagsy.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_-UEh34AY5lo9oFIw3y7y-w_PW0yNwMs';

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

    // 1b. Flush pending offline deletes for products
    try {
      const pendingDeletes = await posDb.getPendingDeletes();
      for (const d of pendingDeletes) {
        let deleted = false;
        if (d.productId) {
          const { error, count } = await client
            .from('products')
            .delete({ count: 'exact' })
            .eq('id', d.productId);
          if (!error && count !== null && count > 0) deleted = true;
        }
        if (!deleted && d.barcode && d.barcode.trim()) {
          const { error, count } = await client
            .from('products')
            .delete({ count: 'exact' })
            .eq('barcode', d.barcode.trim());
          if (!error && count !== null && count > 0) deleted = true;
        }
        if (!deleted && d.name && d.name.trim()) {
          await client.from('products').delete().eq('name', d.name.trim());
        }
        await posDb.clearPendingDelete(d.id);
        syncedCount++;
      }
    } catch (delSyncErr) {
      console.warn('Error flushing pending deletes during sync:', delSyncErr);
    }

    // 2. Fetch remote products to sync locally & reconcile local IndexedDB
    try {
      const remainingPendingDeletes = await posDb.getPendingDeletes();
      const hasPendingDeletes = remainingPendingDeletes.length > 0;

      const { data: remoteProducts, error: prodErr } = await client.from('products').select('*');
      if (!prodErr && remoteProducts && Array.isArray(remoteProducts)) {
        const cleanRemote: Product[] = remoteProducts.filter((p: any) => !DEMO_PRODUCT_IDS.includes(p.id));

        // When online with no pending offline deletes, reconcile local IndexedDB:
        // Any local product whose ID/barcode/name is missing from Supabase must be deleted locally.
        if (!hasPendingDeletes) {
          const localProducts = await posDb.getAll<Product>('products');
          const remoteIdSet = new Set(cleanRemote.map((p) => p.id));
          const remoteBarcodeSet = new Set(
            cleanRemote
              .filter((p) => p.barcode && typeof p.barcode === 'string' && p.barcode.trim())
              .map((p) => (p.barcode as string).toLowerCase().trim())
          );
          const remoteNameSet = new Set(
            cleanRemote
              .filter((p) => p.name && typeof p.name === 'string' && p.name.trim())
              .map((p) => (p.name as string).toLowerCase().trim())
          );

          // Find products pending creation in the offline sync queue so we do not delete them
          const freshQueue = await posDb.getSyncQueue();
          const pendingCreationIds = new Set(
            freshQueue
              .filter((q) => q.table === 'products' && (q.action === 'insert' || q.action === 'update'))
              .map((q) => q.data?.id)
          );

          for (const lp of localProducts) {
            if (DEMO_PRODUCT_IDS.includes(lp.id)) {
              await posDb.delete('products', lp.id);
              continue;
            }
            if (pendingCreationIds.has(lp.id)) {
              continue;
            }

            const lpBarcode = (lp.barcode || '').toLowerCase().trim();
            const lpName = (lp.name || '').toLowerCase().trim();

            const existsRemotely =
              remoteIdSet.has(lp.id) ||
              (lpBarcode && remoteBarcodeSet.has(lpBarcode)) ||
              (lpName && remoteNameSet.has(lpName));

            if (!existsRemotely) {
              await posDb.delete('products', lp.id);
            }
          }
        }

        // Put active remote products into local IndexedDB
        for (const rp of cleanRemote) {
          await posDb.put('products', rp);
        }
      }
    } catch (e) {
      console.warn('Error pulling/reconciling remote products:', e);
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
