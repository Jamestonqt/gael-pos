import { Product, Sale, UtangCustomer, UtangTransaction, WalletLog, StoreSettings } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SETTINGS, DEMO_PRODUCT_IDS } from './seedData';

const DB_NAME = 'GaelPosDB';
const DB_VERSION = 3;

export interface PendingUpsertRecord {
  id: string; // productId
  product: Product;
  timestamp: string;
}

export interface PendingDeleteRecord {
  id: string; // productId
  productId: string;
  barcode?: string;
  name?: string;
  timestamp: string;
}

export interface SyncQueueItem {
  id: string;
  table: 'products' | 'sales' | 'utang_customers' | 'utang_transactions' | 'wallet_logs';
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

class LocalStorageFallback {
  private getKey(store: string) {
    return `gael_pos_${store}`;
  }

  getStore<T>(store: string): T[] {
    try {
      const data = localStorage.getItem(this.getKey(store));
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('LocalStorage read error:', e);
      return [];
    }
  }

  setStore<T>(store: string, items: T[]): void {
    try {
      localStorage.setItem(this.getKey(store), JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }

  getItem<T extends { id: string }>(store: string, id: string): T | undefined {
    const list = this.getStore<T>(store);
    return list.find((item) => item.id === id);
  }

  putItem<T extends { id: string }>(store: string, item: T): void {
    const list = this.getStore<T>(store);
    const index = list.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    this.setStore(store, list);
  }

  deleteItem(store: string, id: string): void {
    const list = this.getStore<{ id: string }>(store);
    this.setStore(
      store,
      list.filter((i) => i.id !== id)
    );
  }
}

const fallbackStorage = new LocalStorageFallback();

export class PosDatabase {
  private db: IDBDatabase | null = null;
  private isFallback = false;

  async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not supported, falling back to localStorage');
      this.isFallback = true;
      this.seedFallbackIfNeeded();
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('products')) {
            const prodStore = db.createObjectStore('products', { keyPath: 'id' });
            prodStore.createIndex('category', 'category', { unique: false });
            prodStore.createIndex('barcode', 'barcode', { unique: false });
          }
          if (!db.objectStoreNames.contains('sales')) {
            const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
            salesStore.createIndex('created_at', 'created_at', { unique: false });
            salesStore.createIndex('payment_method', 'payment_method', { unique: false });
          }
          if (!db.objectStoreNames.contains('utang_customers')) {
            db.createObjectStore('utang_customers', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('utang_transactions')) {
            const utangStore = db.createObjectStore('utang_transactions', { keyPath: 'id' });
            utangStore.createIndex('customer_id', 'customer_id', { unique: false });
          }
          if (!db.objectStoreNames.contains('wallet_logs')) {
            const walletStore = db.createObjectStore('wallet_logs', { keyPath: 'id' });
            walletStore.createIndex('created_at', 'created_at', { unique: false });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('sync_queue')) {
            db.createObjectStore('sync_queue', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('pending_deletes')) {
            db.createObjectStore('pending_deletes', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('pending_upserts')) {
            db.createObjectStore('pending_upserts', { keyPath: 'id' });
          }
        };

        request.onsuccess = async (event: Event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          await this.seedIfNeeded();
          resolve();
        };

        request.onerror = (e) => {
          console.warn('IndexedDB failed to open, using LocalStorage fallback', e);
          this.isFallback = true;
          this.seedFallbackIfNeeded();
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB exception, using LocalStorage fallback', err);
        this.isFallback = true;
        this.seedFallbackIfNeeded();
        resolve();
      }
    });
  }

  private async seedIfNeeded(): Promise<void> {
    // Purge any legacy hardcoded demo products from earlier runs
    for (const demoId of DEMO_PRODUCT_IDS) {
      await this.delete('products', demoId);
    }

    // Use a one-time seed flag so users can safely delete all products
    // without the app re-inserting demo data on the next page load.
    const seeded = await this.getById<{ id: string; value: boolean }>('settings', 'has_seeded_products');
    if (seeded?.value) {
      // Already seeded once — never re-insert products automatically again.
      const customers = await this.getAll<UtangCustomer>('utang_customers');
      if (customers.length === 0) {
        await this._seedCustomers();
      }
      const settings = await this.getSettings();
      if (!settings) {
        await this.saveSettings(INITIAL_SETTINGS);
      }
      return;
    }

    const products = await this.getAll<Product>('products');
    if (products.length === 0 && INITIAL_PRODUCTS.length > 0) {
      for (const p of INITIAL_PRODUCTS) {
        await this.put('products', p);
      }
    }

    await this._seedCustomers();

    const settings = await this.getSettings();
    if (!settings) {
      await this.saveSettings(INITIAL_SETTINGS);
    }

    // Mark seeded — from now on, an empty products store means the user cleared it intentionally.
    await this.put('settings', { id: 'has_seeded_products', value: true } as any);
  }

  private async _seedCustomers(): Promise<void> {
    const customers = await this.getAll<UtangCustomer>('utang_customers');
    if (customers.length === 0) {
      for (const c of INITIAL_CUSTOMERS) {
        await this.put('utang_customers', c);
      }

      const nenaTx: UtangTransaction = {
        id: 'tx_seed_nena_1',
        customer_id: 'cust_aling_nena',
        sale_id: null,
        entry_type: 'charge',
        payment_channel: 'Store Credit Adjustment',
        amount: 145.00,
        balance_after: 145.00,
        notes: 'Initial credit balance from previous ledger',
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      };
      await this.put('utang_transactions', nenaTx);

      const bertingTx: UtangTransaction = {
        id: 'tx_seed_berting_1',
        customer_id: 'cust_mang_berting',
        sale_id: null,
        entry_type: 'charge',
        payment_channel: 'Store Credit Adjustment',
        amount: 485.00,
        balance_after: 485.00,
        notes: 'Initial balance (fuel & drinks)',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      };
      await this.put('utang_transactions', bertingTx);
    }
  }

  private seedFallbackIfNeeded(): void {
    // Purge demo items from fallback storage
    for (const demoId of DEMO_PRODUCT_IDS) {
      fallbackStorage.deleteItem('products', demoId);
    }

    const hasSeeded = localStorage.getItem('gael_pos_has_seeded_products');
    if (!hasSeeded) {
      localStorage.setItem('gael_pos_has_seeded_products', 'true');
    }

    const customers = fallbackStorage.getStore<UtangCustomer>('utang_customers');
    if (customers.length === 0) {
      fallbackStorage.setStore('utang_customers', INITIAL_CUSTOMERS);
    }

    const savedSettings = localStorage.getItem('gael_pos_settings');
    if (!savedSettings) {
      localStorage.setItem('gael_pos_settings', JSON.stringify(INITIAL_SETTINGS));
    }
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (this.isFallback || !this.db) {
      return fallbackStorage.getStore<T>(storeName);
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) {
        resolve(fallbackStorage.getStore<T>(storeName));
      }
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    if (this.isFallback || !this.db) {
      return fallbackStorage.getItem<T & { id: string }>(storeName, id);
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        resolve(fallbackStorage.getItem<T & { id: string }>(storeName, id));
      }
    });
  }

  async put<T extends { id: string }>(storeName: string, item: T): Promise<void> {
    if (this.isFallback || !this.db) {
      fallbackStorage.putItem(storeName, item);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) {
        fallbackStorage.putItem(storeName, item);
        resolve();
      }
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    if (this.isFallback || !this.db) {
      fallbackStorage.deleteItem(storeName, id);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) {
        fallbackStorage.deleteItem(storeName, id);
        resolve();
      }
    });
  }

  async clear(storeName: string): Promise<void> {
    if (this.isFallback || !this.db) {
      fallbackStorage.setStore(storeName, []);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) {
        fallbackStorage.setStore(storeName, []);
        resolve();
      }
    });
  }

  async getSettings(): Promise<StoreSettings | null> {
    if (this.isFallback || !this.db) {
      const raw = localStorage.getItem('gael_pos_settings');
      return raw ? JSON.parse(raw) : INITIAL_SETTINGS;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get('main_settings');
        req.onsuccess = () => {
          resolve(req.result ? req.result.data : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async saveSettings(settings: StoreSettings): Promise<void> {
    if (this.isFallback || !this.db) {
      localStorage.setItem('gael_pos_settings', JSON.stringify(settings));
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const req = store.put({ key: 'main_settings', data: settings });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) {
        localStorage.setItem('gael_pos_settings', JSON.stringify(settings));
        resolve();
      }
    });
  }

  // Sync Queue management
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    await this.put('sync_queue', queueItem);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.getAll<SyncQueueItem>('sync_queue');
  }

  async clearSyncQueueItem(id: string): Promise<void> {
    await this.delete('sync_queue', id);
  }

  // Pending Deletes queue management (for offline-deleted items)
  async addPendingDelete(item: Omit<PendingDeleteRecord, 'timestamp'>): Promise<void> {
    const record: PendingDeleteRecord = {
      ...item,
      id: item.id || item.productId,
      timestamp: new Date().toISOString(),
    };
    await this.put('pending_deletes', record);
  }

  async getPendingDeletes(): Promise<PendingDeleteRecord[]> {
    return this.getAll<PendingDeleteRecord>('pending_deletes');
  }

  async clearPendingDelete(id: string): Promise<void> {
    await this.delete('pending_deletes', id);
  }

  async clearAllPendingDeletes(): Promise<void> {
    await this.clear('pending_deletes');
  }

  // Pending Upserts queue management (for offline-added/updated products)
  async addPendingUpsert(product: Product): Promise<void> {
    const record: PendingUpsertRecord = {
      id: product.id,
      product,
      timestamp: new Date().toISOString(),
    };
    await this.put('pending_upserts', record);
  }

  async getPendingUpserts(): Promise<PendingUpsertRecord[]> {
    return this.getAll<PendingUpsertRecord>('pending_upserts');
  }

  async clearPendingUpsert(id: string): Promise<void> {
    await this.delete('pending_upserts', id);
  }

  async clearAllPendingUpserts(): Promise<void> {
    await this.clear('pending_upserts');
  }

  // Export full JSON backup
  async exportFullBackup(): Promise<string> {
    const products = await this.getAll<Product>('products');
    const sales = await this.getAll<Sale>('sales');
    const customers = await this.getAll<UtangCustomer>('utang_customers');
    const utangTx = await this.getAll<UtangTransaction>('utang_transactions');
    const walletLogs = await this.getAll<WalletLog>('wallet_logs');
    const settings = await this.getSettings();

    const backupData = {
      app: 'Gael-POS',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      products,
      sales,
      utang_customers: customers,
      utang_transactions: utangTx,
      wallet_logs: walletLogs,
      settings: settings || INITIAL_SETTINGS,
    };

    return JSON.stringify(backupData, null, 2);
  }

  // Import JSON backup
  async importFullBackup(jsonContent: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonContent);
      if (!data.app || data.app !== 'Gael-POS') {
        return { success: false, message: 'Invalid backup file format (not a Gael-POS backup).' };
      }

      if (Array.isArray(data.products)) {
        for (const p of data.products) await this.put('products', p);
      }
      if (Array.isArray(data.sales)) {
        for (const s of data.sales) await this.put('sales', s);
      }
      if (Array.isArray(data.utang_customers)) {
        for (const c of data.utang_customers) await this.put('utang_customers', c);
      }
      if (Array.isArray(data.utang_transactions)) {
        for (const t of data.utang_transactions) await this.put('utang_transactions', t);
      }
      if (Array.isArray(data.wallet_logs)) {
        for (const w of data.wallet_logs) await this.put('wallet_logs', w);
      }
      if (data.settings) {
        await this.saveSettings(data.settings);
      }

      return { success: true, message: 'Backup imported successfully! Data restored.' };
    } catch (e: any) {
      return { success: false, message: `Failed to import backup: ${e?.message || 'Invalid JSON'}` };
    }
  }
}

export const posDb = new PosDatabase();
