import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  CartItem,
  Sale,
  SaleItem,
  UtangCustomer,
  UtangTransaction,
  WalletLog,
  StoreSettings,
  SyncState,
  PaymentMethod,
  WalletServiceType,
  UtangPaymentChannel,
} from '../types';
import { posDb } from '../db/indexedDb';
import { checkNetworkAndSyncStatus, syncWithSupabase, getSupabaseClient, isSupabaseConfigured } from '../db/supabaseClient';
import { generateId, generateReceiptNo } from '../utils/formatters';
import { INITIAL_SETTINGS, DEMO_PRODUCT_IDS } from '../db/seedData';
import { DEFAULT_CATEGORIES } from '../utils/categoryIcons';
import { ParsedProductRow, cleanAndNormalizeProductRow } from '../utils/csvInventory';

interface CheckoutOptions {
  paymentMethod: PaymentMethod;
  cashTendered: number;
  utangCustomerId?: string | null;
  notes?: string;
  discountAmount?: number;
}

interface StoreContextType {
  products: Product[];
  cart: CartItem[];
  customers: UtangCustomer[];
  transactions: UtangTransaction[];
  sales: Sale[];
  walletLogs: WalletLog[];
  settings: StoreSettings;
  syncState: SyncState;
  isLoading: boolean;
  syncMessage: string | null;

  // Cart operations
  addToCart: (product: Product, quantity?: number, includeBottleDeposit?: boolean) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  toggleCartBottleDeposit: (productId: string) => void;
  addCustomCartItem: (name: string, sellingPrice: number, costPrice?: number) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartBottleDepositTotal: number;
  cartTotalAmount: number;
  cartTotalCost: number;

  // Checkout
  checkout: (options: CheckoutOptions) => Promise<{ success: boolean; error?: string; sale?: Sale }>;

  // Utang / Digital Lista
  addOrUpdateCustomer: (customer: Partial<UtangCustomer> & { full_name: string }) => Promise<UtangCustomer>;
  recordUtangPayment: (
    customerId: string,
    amount: number,
    channel: UtangPaymentChannel,
    notes?: string
  ) => Promise<{ success: boolean; error?: string }>;
  getCustomerTransactions: (customerId: string) => UtangTransaction[];

  // Wallet / E-Load
  recordWalletTransaction: (
    serviceType: WalletServiceType,
    referenceNo: string,
    recipientOrNote: string,
    principalAmount: number,
    feeEarned: number
  ) => Promise<WalletLog>;

  // Inventory & Categories
  categories: string[];
  addCategory: (name: string) => Promise<{ success: boolean; error?: string }>;
  deleteCategory: (name: string) => Promise<{ success: boolean; error?: string; affectedCount?: number }>;
  restockProductByPack: (productId: string, packsCount: number) => Promise<void>;
  saveProduct: (productData: Partial<Product> & { name: string; selling_price: number }) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<{ success: boolean; error?: string }>;
  clearAllProducts: () => Promise<{ success: boolean; error?: string }>;

  // Void / Admin
  voidSale: (saleId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  voidWalletTransaction: (logId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  updateSettings: (newSettings: Partial<StoreSettings>, pin?: string) => Promise<{ success: boolean; error?: string }>;

  // Sync & Backup
  triggerSync: () => Promise<void>;
  exportBackup: () => Promise<string>;
  importBackup: (jsonString: string) => Promise<{ success: boolean; message: string }>;
  importProductsFromCsv: (
    items: ParsedProductRow[],
    mode: 'merge' | 'replace'
  ) => Promise<{ success: boolean; importedCount: number; updatedCount: number; error?: string }>;
  refreshData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<UtangCustomer[]>([]);
  const [transactions, setTransactions] = useState<UtangTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [walletLogs, setWalletLogs] = useState<WalletLog[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [syncState, setSyncState] = useState<SyncState>('local-only');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Initialize DB and load all local data
  const loadAllData = useCallback(async () => {
    try {
      await posDb.init();
      const [prods, custs, txs, sls, wLogs, stg, pendingDeletes] = await Promise.all([
        posDb.getAll<Product>('products'),
        posDb.getAll<UtangCustomer>('utang_customers'),
        posDb.getAll<UtangTransaction>('utang_transactions'),
        posDb.getAll<Sale>('sales'),
        posDb.getAll<WalletLog>('wallet_logs'),
        posDb.getSettings(),
        posDb.getPendingDeletes(),
      ]);

      const pendingIds = new Set(pendingDeletes.map((d) => d.productId));
      const pendingBarcodes = new Set(
        pendingDeletes.filter((d) => d.barcode).map((d) => d.barcode!.toLowerCase().trim())
      );
      const pendingNames = new Set(
        pendingDeletes.filter((d) => d.name).map((d) => d.name!.toLowerCase().trim())
      );

      const cleanProds = prods.filter(
        (p) =>
          !DEMO_PRODUCT_IDS.includes(p.id) &&
          !pendingIds.has(p.id) &&
          (!p.barcode || !pendingBarcodes.has(p.barcode.toLowerCase().trim())) &&
          (!p.name || !pendingNames.has(p.name.toLowerCase().trim()))
      );
      setProducts(cleanProds);
      setCustomers(custs);
      setTransactions(txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setSales(sls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setWalletLogs(wLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      if (stg) {
        setSettings(stg);
      }

      const status = await checkNetworkAndSyncStatus();
      setSyncState(status);
    } catch (err) {
      console.error('Failed to load store data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // Listen for online/offline events
    const handleOnline = async () => {
      const status = await checkNetworkAndSyncStatus();
      setSyncState(status);
      if (status === 'online-synced') {
        // Automatically flush pending offline deletes and sync with Supabase
        triggerSync().catch(() => {});
      }
    };
    const handleOffline = () => {
      setSyncState('offline-mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadAllData]);

  // Cart Totals
  const cartSubtotal = cart.reduce((sum, item) => {
    const price = item.custom_price ?? item.product.selling_price;
    return sum + price * item.quantity;
  }, 0);

  const cartBottleDepositTotal = cart.reduce((sum, item) => {
    if (item.include_bottle_deposit) {
      return sum + (item.bottle_deposit_amount || item.product.bottle_deposit_fee || 10) * item.quantity;
    }
    return sum;
  }, 0);

  const cartTotalAmount = cartSubtotal + cartBottleDepositTotal;

  const cartTotalCost = cart.reduce((sum, item) => {
    const cost = item.custom_cost ?? item.product.cost_price;
    return sum + cost * item.quantity;
  }, 0);

  // Cart actions
  const addToCart = (product: Product, quantity = 1, includeBottleDeposit?: boolean) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          include_bottle_deposit: includeBottleDeposit !== undefined ? includeBottleDeposit : existing.include_bottle_deposit,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product,
            quantity,
            include_bottle_deposit: includeBottleDeposit ?? product.has_bottle_deposit,
            bottle_deposit_amount: product.bottle_deposit_fee || 10,
          },
        ];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const toggleCartBottleDeposit = (productId: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, include_bottle_deposit: !item.include_bottle_deposit }
          : item
      )
    );
  };

  const addCustomCartItem = (name: string, sellingPrice: number, costPrice: number = 0) => {
    const customId = `custom_${Date.now()}`;
    const customProduct: Product = {
      id: customId,
      sku: 'CUSTOM-ITEM',
      barcode: '',
      name: name || 'Custom Item',
      category: 'Other',
      unit_label: 'pc',
      pack_size: 1,
      cost_price: Number(costPrice) || 0,
      selling_price: Number(sellingPrice) || 0,
      stock_qty: 9999, // Custom items don't block stock
      low_stock_threshold: 0,
      has_bottle_deposit: false,
      bottle_deposit_fee: 0,
      is_active: true,
    };

    setCart((prev) => [
      ...prev,
      {
        product: customProduct,
        quantity: 1,
        include_bottle_deposit: false,
        bottle_deposit_amount: 0,
        custom_price: Number(sellingPrice) || 0,
        custom_cost: Number(costPrice) || 0,
      },
    ]);
  };

  const clearCart = () => setCart([]);

  // Checkout
  const checkout = async ({
    paymentMethod,
    cashTendered,
    utangCustomerId,
    notes,
    discountAmount = 0,
  }: CheckoutOptions): Promise<{ success: boolean; error?: string; sale?: Sale }> => {
    if (cart.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    const subtotal = cartSubtotal;
    const bottleDeposit = cartBottleDepositTotal;
    const totalAmount = Math.max(0, subtotal + bottleDeposit - discountAmount);
    const totalCost = cartTotalCost;
    const netProfit = totalAmount - totalCost;

    // Utang credit limit validation
    let targetCustomer: UtangCustomer | null = null;
    if (paymentMethod === 'Utang') {
      if (!utangCustomerId) {
        return { success: false, error: 'Please select a customer for Utang checkout.' };
      }
      targetCustomer = customers.find((c) => c.id === utangCustomerId) || null;
      if (!targetCustomer) {
        return { success: false, error: 'Selected customer not found.' };
      }
      if (targetCustomer.is_blocked) {
        return { success: false, error: `Customer ${targetCustomer.full_name} is blocked from new credit.` };
      }
      const newBalance = targetCustomer.current_balance + totalAmount;
      if (newBalance > targetCustomer.credit_limit) {
        return {
          success: false,
          error: `Credit limit exceeded! Current: ₱${targetCustomer.current_balance.toFixed(2)} + ₱${totalAmount.toFixed(2)} = ₱${newBalance.toFixed(2)} (Limit: ₱${targetCustomer.credit_limit.toFixed(2)})`,
        };
      }
    }

    // Cash validation
    if (paymentMethod === 'Cash' && cashTendered < totalAmount) {
      return {
        success: false,
        error: `Insufficient cash tendered: ₱${cashTendered.toFixed(2)} is less than total ₱${totalAmount.toFixed(2)}`,
      };
    }

    const changeDue = paymentMethod === 'Cash' ? Math.max(0, cashTendered - totalAmount) : 0;
    const newReceiptCounter = settings.receipt_counter + 1;
    const receiptNo = generateReceiptNo(newReceiptCounter);

    const saleItems: SaleItem[] = cart.map((item) => ({
      product_id: item.product.id,
      name: item.product.name,
      category: item.product.category,
      unit_price: item.custom_price ?? item.product.selling_price,
      cost_price: item.custom_cost ?? item.product.cost_price,
      quantity: item.quantity,
      has_bottle_deposit: item.include_bottle_deposit,
      bottle_deposit_fee: item.include_bottle_deposit ? item.bottle_deposit_amount : 0,
      subtotal: (item.custom_price ?? item.product.selling_price) * item.quantity,
    }));

    const saleId = generateId('sale');
    const newSale: Sale = {
      id: saleId,
      receipt_no: receiptNo,
      payment_method: paymentMethod,
      subtotal,
      bottle_deposit_total: bottleDeposit,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      total_cost: totalCost,
      net_profit: netProfit,
      cash_tendered: paymentMethod === 'Cash' ? cashTendered : totalAmount,
      change_due: changeDue,
      utang_customer_id: utangCustomerId || null,
      items: saleItems,
      status: 'Completed',
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    // Save sale to DB and queue
    await posDb.put('sales', newSale);
    await posDb.addToSyncQueue({ table: 'sales', action: 'insert', data: newSale });

    // Deduct stock for standard products
    const updatedProducts = [...products];
    for (const item of cart) {
      if (!item.product.id.startsWith('custom_')) {
        const prodIndex = updatedProducts.findIndex((p) => p.id === item.product.id);
        if (prodIndex >= 0) {
          const currentProd = updatedProducts[prodIndex];
          const newQty = Math.max(0, currentProd.stock_qty - item.quantity);
          const updatedProd = { ...currentProd, stock_qty: newQty, updated_at: new Date().toISOString() };
          updatedProducts[prodIndex] = updatedProd;
          await posDb.put('products', updatedProd);
          await posDb.addToSyncQueue({ table: 'products', action: 'update', data: updatedProd });
        }
      }
    }
    setProducts(updatedProducts);

    // If Utang, update customer balance & write utang_transaction
    if (paymentMethod === 'Utang' && targetCustomer) {
      const balanceAfter = targetCustomer.current_balance + totalAmount;
      const updatedCustomer: UtangCustomer = {
        ...targetCustomer,
        current_balance: balanceAfter,
        updated_at: new Date().toISOString(),
      };
      await posDb.put('utang_customers', updatedCustomer);
      await posDb.addToSyncQueue({ table: 'utang_customers', action: 'update', data: updatedCustomer });

      setCustomers((prev) => prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)));

      const utangTxId = generateId('utx');
      const newTx: UtangTransaction = {
        id: utangTxId,
        customer_id: targetCustomer.id,
        sale_id: saleId,
        entry_type: 'charge',
        payment_channel: 'Store Credit Adjustment',
        amount: totalAmount,
        balance_after: balanceAfter,
        notes: `POS Credit Charge #${receiptNo}`,
        created_at: new Date().toISOString(),
      };
      await posDb.put('utang_transactions', newTx);
      await posDb.addToSyncQueue({ table: 'utang_transactions', action: 'insert', data: newTx });

      setTransactions((prev) => [newTx, ...prev]);
    }

    // Update settings: cash drawer or GCash balance, and receipt counter
    const updatedSettings: StoreSettings = {
      ...settings,
      receipt_counter: newReceiptCounter,
      cash_drawer_balance:
        paymentMethod === 'Cash'
          ? settings.cash_drawer_balance + totalAmount
          : settings.cash_drawer_balance,
      gcash_wallet_balance:
        paymentMethod === 'GCash' || paymentMethod === 'Maya'
          ? settings.gcash_wallet_balance + totalAmount
          : settings.gcash_wallet_balance,
    };
    await posDb.saveSettings(updatedSettings);
    setSettings(updatedSettings);

    setSales((prev) => [newSale, ...prev]);
    clearCart();

    return { success: true, sale: newSale };
  };

  // Record Utang Payment
  const recordUtangPayment = async (
    customerId: string,
    amount: number,
    channel: UtangPaymentChannel,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return { success: false, error: 'Customer not found' };
    if (amount <= 0) return { success: false, error: 'Payment amount must be greater than ₱0' };

    const newBalance = Math.max(0, cust.current_balance - amount);
    const updatedCust: UtangCustomer = {
      ...cust,
      current_balance: newBalance,
      updated_at: new Date().toISOString(),
    };

    await posDb.put('utang_customers', updatedCust);
    await posDb.addToSyncQueue({ table: 'utang_customers', action: 'update', data: updatedCust });
    setCustomers((prev) => prev.map((c) => (c.id === cust.id ? updatedCust : c)));

    const txId = generateId('utx_pay');
    const newTx: UtangTransaction = {
      id: txId,
      customer_id: cust.id,
      sale_id: null,
      entry_type: 'payment',
      payment_channel: channel,
      amount,
      balance_after: newBalance,
      notes: notes || `Payment via ${channel}`,
      created_at: new Date().toISOString(),
    };

    await posDb.put('utang_transactions', newTx);
    await posDb.addToSyncQueue({ table: 'utang_transactions', action: 'insert', data: newTx });
    setTransactions((prev) => [newTx, ...prev]);

    // Update drawer or wallet balances
    const updatedSettings = {
      ...settings,
      cash_drawer_balance:
        channel === 'Cash' ? settings.cash_drawer_balance + amount : settings.cash_drawer_balance,
      gcash_wallet_balance:
        channel === 'GCash' || channel === 'Maya'
          ? settings.gcash_wallet_balance + amount
          : settings.gcash_wallet_balance,
    };
    await posDb.saveSettings(updatedSettings);
    setSettings(updatedSettings);

    return { success: true };
  };

  const getCustomerTransactions = (customerId: string): UtangTransaction[] => {
    return transactions.filter((t) => t.customer_id === customerId);
  };

  const addOrUpdateCustomer = async (
    customerData: Partial<UtangCustomer> & { full_name: string }
  ): Promise<UtangCustomer> => {
    const isNew = !customerData.id;
    const customerId = customerData.id || generateId('cust');

    const customer: UtangCustomer = {
      id: customerId,
      full_name: customerData.full_name,
      nickname: customerData.nickname || '',
      contact_number: customerData.contact_number || '',
      address_note: customerData.address_note || '',
      credit_limit: customerData.credit_limit !== undefined ? Number(customerData.credit_limit) : 500,
      current_balance: customerData.current_balance !== undefined ? Number(customerData.current_balance) : 0,
      is_blocked: customerData.is_blocked || false,
      created_at: customerData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await posDb.put('utang_customers', customer);
    await posDb.addToSyncQueue({
      table: 'utang_customers',
      action: isNew ? 'insert' : 'update',
      data: customer,
    });

    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = customer;
        return copy;
      }
      return [customer, ...prev];
    });

    return customer;
  };

  // Wallet / E-Load
  const recordWalletTransaction = async (
    serviceType: WalletServiceType,
    referenceNo: string,
    recipientOrNote: string,
    principalAmount: number,
    feeEarned: number
  ): Promise<WalletLog> => {
    const principal = Number(principalAmount) || 0;
    const fee = Number(feeEarned) || 0;

    let loadDelta = 0;
    let gcashDelta = 0;
    let cashDelta = 0;

    switch (serviceType) {
      case 'E-Load':
        // Store gives load, receives cash principal + fee
        loadDelta = -principal;
        cashDelta = +(principal + fee);
        break;
      case 'GCash Cash-In':
      case 'Maya Cash-In':
        // Customer gives cash + fee, store transfers digital wallet
        gcashDelta = -principal;
        cashDelta = +(principal + fee);
        break;
      case 'GCash Cash-Out':
      case 'Maya Cash-Out':
        // Customer sends digital money to store, store gives cash out
        gcashDelta = +principal;
        cashDelta = -(principal - fee);
        break;
      case 'Wallet Top-Up':
        // Cash from drawer loaded into digital wallet
        cashDelta = -principal;
        gcashDelta = +principal;
        break;
    }

    const logId = generateId('wlog');
    const newLog: WalletLog = {
      id: logId,
      service_type: serviceType,
      reference_no: referenceNo,
      recipient_or_note: recipientOrNote,
      principal_amount: principal,
      fee_earned: fee,
      load_wallet_delta: loadDelta,
      gcash_wallet_delta: gcashDelta,
      cash_drawer_delta: cashDelta,
      created_at: new Date().toISOString(),
    };

    await posDb.put('wallet_logs', newLog);
    await posDb.addToSyncQueue({ table: 'wallet_logs', action: 'insert', data: newLog });

    const newSettings: StoreSettings = {
      ...settings,
      load_wallet_balance: settings.load_wallet_balance + loadDelta,
      gcash_wallet_balance: settings.gcash_wallet_balance + gcashDelta,
      cash_drawer_balance: settings.cash_drawer_balance + cashDelta,
    };
    await posDb.saveSettings(newSettings);
    setSettings(newSettings);

    setWalletLogs((prev) => [newLog, ...prev]);
    return newLog;
  };

  // Inventory Restock Pack to Piece
  const restockProductByPack = async (productId: string, packsCount: number): Promise<void> => {
    const prod = products.find((p) => p.id === productId);
    if (!prod || packsCount <= 0) return;

    const addedPieces = packsCount * (prod.pack_size || 1);
    const updatedProd: Product = {
      ...prod,
      stock_qty: prod.stock_qty + addedPieces,
      updated_at: new Date().toISOString(),
    };

    await posDb.put('products', updatedProd);
    await posDb.addToSyncQueue({ table: 'products', action: 'update', data: updatedProd });
    setProducts((prev) => prev.map((p) => (p.id === prod.id ? updatedProd : p)));
  };

  const saveProduct = async (
    productData: Partial<Product> & { name: string; selling_price: number }
  ): Promise<Product> => {
    const isNew = !productData.id;
    const prodId = productData.id || generateId('prod');

    const product: Product = {
      id: prodId,
      sku: productData.sku || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: productData.barcode || '',
      name: productData.name,
      category: productData.category || 'Other',
      unit_label: productData.unit_label || 'pc',
      pack_size: Number(productData.pack_size) || 1,
      cost_price: Number(productData.cost_price) || 0,
      selling_price: Number(productData.selling_price) || 0,
      stock_qty: Number(productData.stock_qty) || 0,
      low_stock_threshold: Number(productData.low_stock_threshold) || 5,
      has_bottle_deposit: Boolean(productData.has_bottle_deposit),
      bottle_deposit_fee: Number(productData.bottle_deposit_fee) || 0,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      updated_at: new Date().toISOString(),
    };

    await posDb.put('products', product);
    await posDb.addToSyncQueue({
      table: 'products',
      action: isNew ? 'insert' : 'update',
      data: product,
    });

    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = product;
        return copy;
      }
      return [product, ...prev];
    });

    return product;
  };

  const deleteProduct = async (
    productId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Find product details before deletion (needed for fallback matching by barcode or name)
      const targetProduct =
        products.find((p) => p.id === productId) ||
        (await posDb.getById<Product>('products', productId));

      // 1. Delete from local IndexedDB and React state immediately
      await posDb.delete('products', productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const client = getSupabaseClient();
      const isConfigured = isSupabaseConfigured();

      // If offline or Supabase is not configured, queue in pending_deletes
      if (!isOnline || !isConfigured || !client) {
        await posDb.addPendingDelete({
          id: productId,
          productId,
          barcode: targetProduct?.barcode,
          name: targetProduct?.name,
        });
        await posDb.addToSyncQueue({
          table: 'products',
          action: 'delete',
          data: { id: productId, barcode: targetProduct?.barcode, name: targetProduct?.name },
        });
        return { success: true };
      }

      // 2. If online, immediately call Supabase delete
      let deleteSuccess = false;
      let lastErrorMessage: string | null = null;

      // Primary attempt: Match by ID
      const { error: idError, count: idCount } = await client
        .from('products')
        .delete({ count: 'exact' })
        .eq('id', productId);

      if (idError) {
        lastErrorMessage = idError.message;
      } else if (idCount !== null && idCount > 0) {
        deleteSuccess = true;
      }

      // Fallback 1: Match by Barcode if ID didn't match and barcode is present
      if (!deleteSuccess && !lastErrorMessage && targetProduct?.barcode && targetProduct.barcode.trim()) {
        const { error: barcodeError, count: barcodeCount } = await client
          .from('products')
          .delete({ count: 'exact' })
          .eq('barcode', targetProduct.barcode.trim());

        if (barcodeError) {
          lastErrorMessage = barcodeError.message;
        } else if (barcodeCount !== null && barcodeCount > 0) {
          deleteSuccess = true;
        }
      }

      // Fallback 2: Match by Name if neither ID nor barcode matched
      if (!deleteSuccess && !lastErrorMessage && targetProduct?.name && targetProduct.name.trim()) {
        const { error: nameError, count: nameCount } = await client
          .from('products')
          .delete({ count: 'exact' })
          .eq('name', targetProduct.name.trim());

        if (nameError) {
          lastErrorMessage = nameError.message;
        } else if (nameCount !== null && nameCount > 0) {
          deleteSuccess = true;
        }
      }

      // Check if error occurred (e.g. RLS blocking delete)
      if (lastErrorMessage) {
        console.error('Failed to delete product from Supabase:', lastErrorMessage);
        // Queue in pending_deletes so it can retry later
        await posDb.addPendingDelete({
          id: productId,
          productId,
          barcode: targetProduct?.barcode,
          name: targetProduct?.name,
        });
        return {
          success: false,
          error: lastErrorMessage,
        };
      }

      // Succeeded: clear from pending_deletes if present
      await posDb.clearPendingDelete(productId);
      return { success: true };
    } catch (err: any) {
      console.error('Unexpected error in deleteProduct:', err);
      return {
        success: false,
        error: err?.message || 'Failed to delete product',
      };
    }
  };

  const clearAllProducts = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const allCurrentProducts = [...products];
      await posDb.clear('products');
      localStorage.removeItem('gael_pos_products');
      setProducts([]);

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const client = getSupabaseClient();
      const isConfigured = isSupabaseConfigured();

      if (!isOnline || !isConfigured || !client) {
        for (const p of allCurrentProducts) {
          await posDb.addPendingDelete({
            id: p.id,
            productId: p.id,
            barcode: p.barcode,
            name: p.name,
          });
        }
        return { success: true };
      }

      // If online, immediately delete all products from Supabase
      const { error } = await client.from('products').delete().neq('id', '');
      if (error) {
        console.error('Supabase clearAllProducts error:', error);
        return { success: false, error: error.message };
      }

      await posDb.clearAllPendingDeletes();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to clear all products' };
    }
  };

  // Void Sale (protected by Owner PIN)
  const voidSale = async (saleId: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    if (pin !== settings.owner_pin) {
      return { success: false, error: 'Incorrect Owner PIN. Voiding denied.' };
    }

    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Sale record not found' };
    if (sale.status === 'Voided') return { success: false, error: 'Sale is already voided' };

    // 1. Restore product stock quantities
    const updatedProducts = [...products];
    for (const item of sale.items) {
      if (!item.product_id.startsWith('custom_')) {
        const prodIndex = updatedProducts.findIndex((p) => p.id === item.product_id);
        if (prodIndex >= 0) {
          const currentProd = updatedProducts[prodIndex];
          const newQty = currentProd.stock_qty + item.quantity;
          const updatedProd = { ...currentProd, stock_qty: newQty, updated_at: new Date().toISOString() };
          updatedProducts[prodIndex] = updatedProd;
          await posDb.put('products', updatedProd);
          await posDb.addToSyncQueue({ table: 'products', action: 'update', data: updatedProd });
        }
      }
    }
    setProducts(updatedProducts);

    // 2. If it was Utang, revert customer's balance
    if (sale.payment_method === 'Utang' && sale.utang_customer_id) {
      const cust = customers.find((c) => c.id === sale.utang_customer_id);
      if (cust) {
        const revertedBalance = Math.max(0, cust.current_balance - sale.total_amount);
        const updatedCust = { ...cust, current_balance: revertedBalance, updated_at: new Date().toISOString() };
        await posDb.put('utang_customers', updatedCust);
        await posDb.addToSyncQueue({ table: 'utang_customers', action: 'update', data: updatedCust });
        setCustomers((prev) => prev.map((c) => (c.id === cust.id ? updatedCust : c)));

        // Log cancellation transaction
        const voidTx: UtangTransaction = {
          id: generateId('utx_void'),
          customer_id: cust.id,
          sale_id: sale.id,
          entry_type: 'payment',
          payment_channel: 'Store Credit Adjustment',
          amount: sale.total_amount,
          balance_after: revertedBalance,
          notes: `VOIDED Sale #${sale.receipt_no}`,
          created_at: new Date().toISOString(),
        };
        await posDb.put('utang_transactions', voidTx);
        await posDb.addToSyncQueue({ table: 'utang_transactions', action: 'insert', data: voidTx });
        setTransactions((prev) => [voidTx, ...prev]);
      }
    }

    // 3. Update drawer balances if paid cash/digital
    const newSettings = {
      ...settings,
      cash_drawer_balance:
        sale.payment_method === 'Cash'
          ? Math.max(0, settings.cash_drawer_balance - sale.total_amount)
          : settings.cash_drawer_balance,
      gcash_wallet_balance:
        sale.payment_method === 'GCash' || sale.payment_method === 'Maya'
          ? Math.max(0, settings.gcash_wallet_balance - sale.total_amount)
          : settings.gcash_wallet_balance,
    };
    await posDb.saveSettings(newSettings);
    setSettings(newSettings);

    // 4. Mark sale as Voided
    const updatedSale: Sale = {
      ...sale,
      status: 'Voided',
      notes: (sale.notes ? sale.notes + ' | ' : '') + `Voided on ${new Date().toLocaleString()}`,
    };
    await posDb.put('sales', updatedSale);
    await posDb.addToSyncQueue({ table: 'sales', action: 'update', data: updatedSale });
    setSales((prev) => prev.map((s) => (s.id === sale.id ? updatedSale : s)));

    return { success: true };
  };

  const voidWalletTransaction = async (
    logId: string,
    pin: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (pin !== settings.owner_pin) {
      return { success: false, error: 'Incorrect Owner PIN. Voiding denied.' };
    }

    const log = walletLogs.find((w) => w.id === logId);
    if (!log) return { success: false, error: 'Wallet transaction record not found' };
    if (log.is_voided) return { success: false, error: 'Transaction is already voided' };

    // Reverse the balance changes
    const newSettings: StoreSettings = {
      ...settings,
      load_wallet_balance: Math.max(0, settings.load_wallet_balance - log.load_wallet_delta),
      gcash_wallet_balance: Math.max(0, settings.gcash_wallet_balance - log.gcash_wallet_delta),
      cash_drawer_balance: Math.max(0, settings.cash_drawer_balance - log.cash_drawer_delta),
    };
    await posDb.saveSettings(newSettings);
    setSettings(newSettings);

    const updatedLog: WalletLog = {
      ...log,
      is_voided: true,
      voided_at: new Date().toISOString(),
    };
    await posDb.put('wallet_logs', updatedLog);
    await posDb.addToSyncQueue({ table: 'wallet_logs', action: 'update', data: updatedLog });

    setWalletLogs((prev) => prev.map((w) => (w.id === logId ? updatedLog : w)));
    return { success: true };
  };

  const updateSettings = async (
    newSettings: Partial<StoreSettings>,
    pin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (newSettings.owner_pin && pin !== settings.owner_pin) {
      return { success: false, error: 'Current PIN is required to change PIN' };
    }

    const merged = { ...settings, ...newSettings };
    await posDb.saveSettings(merged);
    setSettings(merged);
    return { success: true };
  };

  // Categories logic
  const categories = useMemo(() => {
    const base =
      settings.custom_categories && settings.custom_categories.length > 0
        ? settings.custom_categories
        : DEFAULT_CATEGORIES;
    const set = new Set(base);
    for (const p of products) {
      if (p.category && p.category !== 'All' && !set.has(p.category)) {
        set.add(p.category);
      }
    }
    if (!set.has('Other')) {
      set.add('Other');
    }
    return Array.from(set);
  }, [settings.custom_categories, products]);

  const addCategory = async (name: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Category name cannot be empty.' };
    }
    if (trimmed.toLowerCase() === 'all') {
      return { success: false, error: '"All" is a reserved filter name.' };
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `Category "${trimmed}" already exists.` };
    }

    const updated = [...categories, trimmed];
    await updateSettings({ custom_categories: updated });
    return { success: true };
  };

  const deleteCategory = async (
    name: string
  ): Promise<{ success: boolean; error?: string; affectedCount?: number }> => {
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === 'other') {
      return {
        success: false,
        error: 'The "Other" category is required as a fallback and cannot be deleted.',
      };
    }
    if (trimmed.toLowerCase() === 'all') {
      return { success: false, error: '"All" is a system filter and cannot be deleted.' };
    }

    // Reassign any products in this category to 'Other'
    const affectedProducts = products.filter(
      (p) => p.category?.toLowerCase() === trimmed.toLowerCase()
    );

    for (const p of affectedProducts) {
      const updatedProduct: Product = {
        ...p,
        category: 'Other',
        updated_at: new Date().toISOString(),
      };
      await posDb.put('products', updatedProduct);
      await posDb.addToSyncQueue({ table: 'products', action: 'update', data: updatedProduct });
    }

    if (affectedProducts.length > 0) {
      setProducts((prev) =>
        prev.map((p) =>
          p.category?.toLowerCase() === trimmed.toLowerCase() ? { ...p, category: 'Other' } : p
        )
      );
    }

    const updatedCategories = categories.filter(
      (c) => c.toLowerCase() !== trimmed.toLowerCase()
    );
    if (!updatedCategories.includes('Other')) {
      updatedCategories.push('Other');
    }

    await updateSettings({ custom_categories: updatedCategories });
    return { success: true, affectedCount: affectedProducts.length };
  };

  // Sync with Supabase
  const triggerSync = async () => {
    setSyncState('syncing');
    setSyncMessage('Syncing with Supabase...');
    const result = await syncWithSupabase();
    setSyncMessage(result.message);

    const status = await checkNetworkAndSyncStatus();
    setSyncState(status);

    // Reload latest data after sync
    await loadAllData();

    setTimeout(() => {
      setSyncMessage(null);
    }, 4000);
  };

  const exportBackup = async (): Promise<string> => {
    return posDb.exportFullBackup();
  };

  const importBackup = async (jsonString: string): Promise<{ success: boolean; message: string }> => {
    const result = await posDb.importFullBackup(jsonString);
    if (result.success) {
      await loadAllData();
    }
    return result;
  };

  const importProductsFromCsv = async (
    items: ParsedProductRow[],
    mode: 'merge' | 'replace'
  ): Promise<{ success: boolean; importedCount: number; updatedCount: number; error?: string }> => {
    try {
      const now = new Date().toISOString();

      // 1. Clean and normalize all rows, stripping trailing blank lines and currency symbols
      const cleanedRows = items
        .map(cleanAndNormalizeProductRow)
        .filter((it): it is ParsedProductRow => it !== null && Boolean(it.name && it.name.trim()));

      if (cleanedRows.length === 0) {
        return {
          success: false,
          importedCount: 0,
          updatedCount: 0,
          error: 'No valid products to import. Please check that the file has a name column.',
        };
      }

      // 2. Collect and save any new categories from imported items
      const newCustomCats = new Set<string>(categories);
      for (const item of cleanedRows) {
        if (item.category && item.category !== 'All') {
          newCustomCats.add(item.category);
        }
      }
      if (!newCustomCats.has('Other')) {
        newCustomCats.add('Other');
      }
      const updatedCategoriesList = Array.from(newCustomCats);
      await updateSettings({ custom_categories: updatedCategoriesList });

      // 3. Match existing products on ID or Barcode (or Name in merge mode)
      const client = getSupabaseClient();
      const isConfigured = isSupabaseConfigured();

      // Read current local products from IndexedDB
      const existingLocal = await posDb.getAll<Product>('products');

      // Attempt to pre-fetch remote Supabase products if connected to ensure accurate cross-device matching
      let existingRemote: Product[] = [];
      if (isConfigured && client && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { data, error: fetchErr } = await client.from('products').select('*');
          if (!fetchErr && data && Array.isArray(data)) {
            existingRemote = data;
          }
        } catch (e) {
          console.warn('Pre-fetching remote products failed:', e);
        }
      }

      // Build fast lookup maps: ID -> Product, Barcode -> Product, Name -> Product
      const byId = new Map<string, Product>();
      const byBarcode = new Map<string, Product>();
      const byName = new Map<string, Product>();

      // Seed maps: remote products first, then local (local takes precedence if newer)
      for (const p of [...existingRemote, ...existingLocal]) {
        if (DEMO_PRODUCT_IDS.includes(p.id)) continue;
        if (p.id) byId.set(p.id, p);
        if (p.barcode && p.barcode.trim()) byBarcode.set(p.barcode.trim().toLowerCase(), p);
        if (p.name && p.name.trim()) byName.set(p.name.trim().toLowerCase(), p);
      }

      let importedCount = 0;
      let updatedCount = 0;
      const finalProductsMap = new Map<string, Product>();

      // If merge mode, preserve current existing local products that are not in DEMO_PRODUCT_IDS
      if (mode === 'merge') {
        for (const p of existingLocal) {
          if (!DEMO_PRODUCT_IDS.includes(p.id)) {
            finalProductsMap.set(p.id, p);
          }
        }
      }

      // Process each cleaned row
      for (let idx = 0; idx < cleanedRows.length; idx++) {
        const item = cleanedRows[idx];
        const trimmedBarcode = item.barcode ? item.barcode.trim() : '';

        // Match priority: 1. ID, 2. Non-empty Barcode, 3. Name (in merge mode)
        let match: Product | undefined = undefined;
        if (item.id && byId.has(item.id)) {
          match = byId.get(item.id);
        } else if (trimmedBarcode && byBarcode.has(trimmedBarcode.toLowerCase())) {
          match = byBarcode.get(trimmedBarcode.toLowerCase());
        } else if (mode === 'merge' && byName.has(item.name.trim().toLowerCase())) {
          match = byName.get(item.name.trim().toLowerCase());
        }

        if (match) {
          // Update matched existing product
          updatedCount++;
          const updatedProd: Product = {
            ...match,
            barcode: trimmedBarcode || match.barcode || '',
            name: item.name,
            category: item.category || match.category || 'Other',
            unit_label: item.unit || match.unit_label || 'pc',
            cost_price: item.cost,
            selling_price: item.price,
            stock_qty: item.stock,
            is_active: true,
            updated_at: now,
          };
          finalProductsMap.set(updatedProd.id, updatedProd);
          byId.set(updatedProd.id, updatedProd);
          if (updatedProd.barcode) byBarcode.set(updatedProd.barcode.toLowerCase(), updatedProd);
          byName.set(updatedProd.name.trim().toLowerCase(), updatedProd);
        } else {
          // Insert new product row (when barcode is empty or brand new)
          importedCount++;
          const newId = item.id || generateId('prod');
          const newProd: Product = {
            id: newId,
            sku: `SKU-${trimmedBarcode ? trimmedBarcode.slice(-6) : (Date.now() + idx).toString().slice(-6)}`,
            barcode: trimmedBarcode,
            name: item.name,
            category: item.category || 'Other',
            unit_label: item.unit || 'pc',
            pack_size: 1,
            cost_price: item.cost,
            selling_price: item.price,
            stock_qty: item.stock,
            low_stock_threshold: 5,
            has_bottle_deposit: false,
            bottle_deposit_fee: 0,
            is_active: true,
            created_at: now,
            updated_at: now,
          };
          finalProductsMap.set(newProd.id, newProd);
          byId.set(newProd.id, newProd);
          if (newProd.barcode) byBarcode.set(newProd.barcode.toLowerCase(), newProd);
          byName.set(newProd.name.trim().toLowerCase(), newProd);
        }
      }

      const finalProductsList = Array.from(finalProductsMap.values());

      // 4. Save to IndexedDB first for offline safety
      if (mode === 'replace') {
        await posDb.clear('products');
      }
      for (const prod of finalProductsList) {
        await posDb.put('products', prod);
      }
      setProducts(finalProductsList);

      // 5. Immediately run Supabase upsert on the products table
      if (isConfigured && client) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // If device is offline, queue changes to sync queue for automatic sync later
          for (const prod of finalProductsList) {
            await posDb.addToSyncQueue({ table: 'products', action: 'insert', data: prod });
          }
          return {
            success: true,
            importedCount,
            updatedCount,
            error: 'Saved locally in IndexedDB. Device is offline; products will sync to Supabase once connected.',
          };
        }

        // If replace mode, clear remote products table first so old products are wiped
        if (mode === 'replace') {
          const { error: delErr } = await client.from('products').delete().neq('id', '');
          if (delErr) {
            console.error('Supabase delete during replace failed:', delErr);
            return {
              success: false,
              importedCount,
              updatedCount,
              error: `Supabase error while clearing old products: ${delErr.message}`,
            };
          }
        }

        // Prepare records matching the Supabase products table schema
        const payload = finalProductsList.map((p) => ({
          id: p.id,
          sku: p.sku || null,
          barcode: p.barcode && p.barcode.trim() ? p.barcode.trim() : null,
          name: p.name,
          category: p.category,
          unit_label: p.unit_label || 'pc',
          pack_size: p.pack_size || 1,
          cost_price: Number(p.cost_price.toFixed(2)),
          selling_price: Number(p.selling_price.toFixed(2)),
          stock_qty: Math.round(p.stock_qty),
          low_stock_threshold: p.low_stock_threshold || 5,
          has_bottle_deposit: Boolean(p.has_bottle_deposit),
          bottle_deposit_fee: Number(p.bottle_deposit_fee || 0),
          is_active: p.is_active !== false,
          updated_at: p.updated_at || now,
        }));

        // Batch upsert in chunks of 100 to avoid payload limits
        const BATCH_SIZE = 100;
        for (let i = 0; i < payload.length; i += BATCH_SIZE) {
          const chunk = payload.slice(i, i + BATCH_SIZE);
          const { error: upsertErr } = await client
            .from('products')
            .upsert(chunk, { onConflict: 'id' });

          if (upsertErr) {
            console.error('Supabase upsert failed:', upsertErr);
            return {
              success: false,
              importedCount,
              updatedCount,
              error: `Supabase upsert error: ${upsertErr.message}`,
            };
          }
        }

        // 6. Reload products state from Supabase after successful import
        const { data: remoteData, error: reloadErr } = await client
          .from('products')
          .select('*')
          .order('name', { ascending: true });

        if (reloadErr) {
          console.error('Failed to reload products from Supabase:', reloadErr);
          return {
            success: false,
            importedCount,
            updatedCount,
            error: `Products saved, but failed to reload from Supabase: ${reloadErr.message}`,
          };
        }

        if (remoteData) {
          const cleanProds: Product[] = remoteData
            .filter((p: any) => !DEMO_PRODUCT_IDS.includes(p.id))
            .map((p: any) => ({
              id: p.id,
              sku: p.sku || '',
              barcode: p.barcode || '',
              name: p.name,
              category: p.category,
              unit_label: p.unit_label || 'pc',
              pack_size: p.pack_size || 1,
              cost_price: Number(p.cost_price) || 0,
              selling_price: Number(p.selling_price) || 0,
              stock_qty: Math.round(Number(p.stock_qty)) || 0,
              low_stock_threshold: p.low_stock_threshold || 5,
              has_bottle_deposit: Boolean(p.has_bottle_deposit),
              bottle_deposit_fee: Number(p.bottle_deposit_fee) || 0,
              is_active: p.is_active !== false,
              updated_at: p.updated_at,
            }));

          setProducts(cleanProds);
          // Mirror refreshed products to IndexedDB
          for (const rp of cleanProds) {
            await posDb.put('products', rp);
          }
        }
      }

      return { success: true, importedCount, updatedCount };
    } catch (err: any) {
      console.error('Error in importProductsFromCsv:', err);
      return {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        error: err?.message || 'Failed to import products',
      };
    }
  };

  const refreshData = async () => {
    await loadAllData();
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        cart,
        customers,
        transactions,
        sales,
        walletLogs,
        settings,
        syncState,
        isLoading,
        syncMessage,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        toggleCartBottleDeposit,
        addCustomCartItem,
        clearCart,
        cartSubtotal,
        cartBottleDepositTotal,
        cartTotalAmount,
        cartTotalCost,
        checkout,
        addOrUpdateCustomer,
        recordUtangPayment,
        getCustomerTransactions,
        recordWalletTransaction,
        categories,
        addCategory,
        deleteCategory,
        restockProductByPack,
        saveProduct,
        deleteProduct,
        clearAllProducts,
        voidSale,
        voidWalletTransaction,
        updateSettings,
        triggerSync,
        exportBackup,
        importBackup,
        importProductsFromCsv,
        refreshData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
