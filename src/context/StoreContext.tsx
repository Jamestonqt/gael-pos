import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
import { checkNetworkAndSyncStatus, syncWithSupabase } from '../db/supabaseClient';
import { generateId, generateReceiptNo } from '../utils/formatters';
import { INITIAL_SETTINGS } from '../db/seedData';

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

  // Inventory
  restockProductByPack: (productId: string, packsCount: number) => Promise<void>;
  saveProduct: (productData: Partial<Product> & { name: string; selling_price: number }) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<void>;

  // Void / Admin
  voidSale: (saleId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  updateSettings: (newSettings: Partial<StoreSettings>, pin?: string) => Promise<{ success: boolean; error?: string }>;

  // Sync & Backup
  triggerSync: () => Promise<void>;
  exportBackup: () => Promise<string>;
  importBackup: (jsonString: string) => Promise<{ success: boolean; message: string }>;
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
      const [prods, custs, txs, sls, wLogs, stg] = await Promise.all([
        posDb.getAll<Product>('products'),
        posDb.getAll<UtangCustomer>('utang_customers'),
        posDb.getAll<UtangTransaction>('utang_transactions'),
        posDb.getAll<Sale>('sales'),
        posDb.getAll<WalletLog>('wallet_logs'),
        posDb.getSettings(),
      ]);

      setProducts(prods);
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

  const deleteProduct = async (productId: string): Promise<void> => {
    await posDb.delete('products', productId);
    await posDb.addToSyncQueue({
      table: 'products',
      action: 'delete',
      data: { id: productId },
    });
    setProducts((prev) => prev.filter((p) => p.id !== productId));
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
        restockProductByPack,
        saveProduct,
        deleteProduct,
        voidSale,
        updateSettings,
        triggerSync,
        exportBackup,
        importBackup,
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
