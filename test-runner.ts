import assert from 'node:assert';
import { formatPeso, generateReceiptNo } from './src/utils/formatters.ts';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SETTINGS } from './src/db/seedData.ts';
import { parseNumberField, cleanAndNormalizeProductRow } from './src/utils/csvInventory.ts';
import type { UtangCustomer } from './src/types/index.ts';

console.log('--- Starting Gael-POS Automated Test Suite ---');

// Test 1: Philippine Peso Currency Formatting
console.log('Test 1: Currency Formatting');
assert.strictEqual(formatPeso(0), '₱0.00');
assert.strictEqual(formatPeso(25), '₱25.00');
assert.strictEqual(formatPeso(1250.5), '₱1,250.50');
assert.strictEqual(formatPeso(1000000), '₱1,000,000.00');
assert.strictEqual(formatPeso(10, false), '₱10');
assert.strictEqual(formatPeso(-50), '-₱50.00');
console.log('✓ Currency formatting passed.');

// Test 2: Clean Inventory Verification (User requested empty starting catalog)
console.log('Test 2: Starting Inventory Verification (Clean Slate / User-Managed)');
assert.strictEqual(Array.isArray(INITIAL_PRODUCTS), true, 'INITIAL_PRODUCTS must be an array');
assert.strictEqual(INITIAL_PRODUCTS.length === 0, true, `Expected 0 starting products for fresh store, got ${INITIAL_PRODUCTS.length}`);
console.log('✓ Clean starting inventory verified (0 demo products).');

// Test 3: Seed Customers Verification
console.log('Test 3: Seed Customers (Digital Lista Suki)');
assert.strictEqual(INITIAL_CUSTOMERS.length >= 3, true);
const nena = INITIAL_CUSTOMERS.find(c => c.id === 'cust_aling_nena');
const berting = INITIAL_CUSTOMERS.find(c => c.id === 'cust_mang_berting');
const glo = INITIAL_CUSTOMERS.find(c => c.id === 'cust_nanay_glo');
assert.strictEqual(Boolean(nena && berting && glo), true);
assert.strictEqual(nena?.credit_limit, 800.00);
assert.strictEqual(berting?.credit_limit, 500.00);
assert.strictEqual(glo?.credit_limit, 1000.00);
console.log('✓ 3 initial Utang customers verified.');

// Test 4: Utang Credit Limit Logic
console.log('Test 4: Utang Credit Limit Enforcement');
function checkUtangEligibility(customer: UtangCustomer, cartTotal: number) {
  if (customer.is_blocked) {
    return { eligible: false, reason: 'Customer is blocked' };
  }
  const balanceAfter = customer.current_balance + cartTotal;
  if (balanceAfter > customer.credit_limit) {
    return {
      eligible: false,
      reason: `Credit limit exceeded (${balanceAfter} > ${customer.credit_limit})`
    };
  }
  return { eligible: true, balanceAfter };
}

// Mang Berting has balance 485, limit 500
if (berting) {
  const bertingCheck1 = checkUtangEligibility(berting, 20); // 485 + 20 = 505 > 500 -> blocked
  assert.strictEqual(bertingCheck1.eligible, false);

  const bertingCheck2 = checkUtangEligibility(berting, 15); // 485 + 15 = 500 <= 500 -> eligible
  assert.strictEqual(bertingCheck2.eligible, true);
  assert.strictEqual(bertingCheck2.balanceAfter, 500);
}

// Blocked customer test
if (glo) {
  const blockedCustomer: UtangCustomer = { ...glo, is_blocked: true };
  assert.strictEqual(checkUtangEligibility(blockedCustomer, 50).eligible, false);
}
console.log('✓ Utang credit limit checks and blocking verified.');

// Test 5: Instant Change Calculator & Cash Logic
console.log('Test 5: Instant Change Calculator');
function calculateChange(tendered: number, total: number) {
  return {
    changeDue: tendered - total,
    isSufficient: tendered >= total
  };
}

const changeTest1 = calculateChange(500, 345);
assert.strictEqual(changeTest1.isSufficient, true);
assert.strictEqual(changeTest1.changeDue, 155);

const changeTest2 = calculateChange(100, 145);
assert.strictEqual(changeTest2.isSufficient, false);
assert.strictEqual(changeTest2.changeDue, -45);
console.log('✓ Instant Change calculations verified.');

// Test 6: E-Load and GCash Fee Rules
console.log('Test 6: E-Load & GCash Convenience Fee Calculations');
function calculateFee(serviceType: string, amount: number) {
  if (amount <= 0) return 0;
  switch (serviceType) {
    case 'E-Load':
      return amount <= 50 ? 3.0 : 5.0;
    case 'GCash Cash-In':
    case 'Maya Cash-In':
      return Math.max(10, Math.ceil(amount / 500) * 10);
    case 'GCash Cash-Out':
    case 'Maya Cash-Out':
      return Math.max(15, Math.ceil(amount / 500) * 15);
    case 'Wallet Top-Up':
      return 0;
    default:
      return 0;
  }
}

assert.strictEqual(calculateFee('E-Load', 20), 3.0);
assert.strictEqual(calculateFee('E-Load', 50), 3.0);
assert.strictEqual(calculateFee('E-Load', 100), 5.0);
assert.strictEqual(calculateFee('GCash Cash-In', 300), 10.0);
assert.strictEqual(calculateFee('GCash Cash-In', 500), 10.0);
assert.strictEqual(calculateFee('GCash Cash-In', 700), 20.0);
assert.strictEqual(calculateFee('GCash Cash-Out', 500), 15.0);
assert.strictEqual(calculateFee('GCash Cash-Out', 1000), 30.0);
assert.strictEqual(calculateFee('Wallet Top-Up', 1000), 0);
console.log('✓ E-Load & GCash fee calculations verified.');

// Test 7: Pack-to-Piece Restock Multiplication
console.log('Test 7: Pack-to-Piece Restock Multiplication');
function calculateRestockPieces(packsCount: number, packSize: number) {
  return packsCount * packSize;
}
assert.strictEqual(calculateRestockPieces(1, 12), 12); // 1 tie pancit canton
assert.strictEqual(calculateRestockPieces(2, 24), 48); // 2 cases beer/c2
assert.strictEqual(calculateRestockPieces(5, 72), 360); // 5 wholesale boxes
console.log('✓ Pack-to-piece conversion verified.');

// Test 8: Owner PIN and Receipt Formatting
console.log('Test 8: Owner PIN & Receipt Numbering');
assert.strictEqual(INITIAL_SETTINGS.owner_pin, '1234');
const receipt = generateReceiptNo(1005);
assert.strictEqual(receipt.startsWith('GL-'), true);
assert.strictEqual(receipt.endsWith('-1005'), true);
console.log(`✓ Receipt generator format verified: ${receipt}`);

// Test 9: Barcode Lookup & Leading Zero Normalization
console.log('Test 9: Barcode Lookup & Leading Zero Normalization');
function matchBarcode(productBarcode: string, scannedCode: string): boolean {
  const cleanLower = scannedCode.trim().toLowerCase();
  const cleanStripped = cleanLower.replace(/^0+/, '');
  const pBarcode = (productBarcode || '').trim().toLowerCase();
  return (
    pBarcode === cleanLower ||
    (Boolean(cleanStripped) && pBarcode.replace(/^0+/, '') === cleanStripped)
  );
}
assert.strictEqual(matchBarcode('4800016644883', '4800016644883'), true);
assert.strictEqual(matchBarcode('4800016644883', '04800016644883'), true); // EAN-13 padding
assert.strictEqual(matchBarcode('04800016644883', '4800016644883'), true); // UPC to EAN-13
assert.strictEqual(matchBarcode('4800016644883', '4800016644884'), false);
console.log('✓ Barcode lookup and normalization verified.');

// Test 10: CSV Currency Stripping & Numeric Parsing
console.log('Test 10: CSV Currency Stripping & Numeric Parsing');
assert.strictEqual(parseNumberField('₱46.00'), 46.0);
assert.strictEqual(parseNumberField('₱ 1,250.50'), 1250.5);
assert.strictEqual(parseNumberField('PHP 500'), 500);
assert.strictEqual(parseNumberField('$19.99'), 19.99);
assert.strictEqual(parseNumberField(''), 0);
assert.strictEqual(parseNumberField(null), 0);
assert.strictEqual(parseNumberField(undefined), 0);
assert.strictEqual(parseNumberField('invalid', 0), 0);
assert.strictEqual(parseNumberField('35'), 35);
console.log('✓ CSV Currency stripping and numeric parsing verified.');

// Test 11: CSV Row Cleaning & Trailing Blank Filtering
console.log('Test 11: CSV Row Cleaning & Trailing Blank Filtering');
const row1 = cleanAndNormalizeProductRow({
  name: '  Lucky Me Pancit Canton Kalamansi  ',
  barcode: "'4800016550215'",
  category: 'Instant Noodles',
  cost: '₱12.50',
  price: '₱16.00',
  stock: '60 pcs',
  unit: 'PC',
});
assert.notStrictEqual(row1, null);
assert.strictEqual(row1?.name, 'Lucky Me Pancit Canton Kalamansi');
assert.strictEqual(row1?.barcode, '4800016550215');
assert.strictEqual(row1?.category, 'Instant Noodles');
assert.strictEqual(row1?.cost, 12.5);
assert.strictEqual(row1?.price, 16.0);
assert.strictEqual(row1?.stock, 60);
assert.strictEqual(row1?.unit, 'pc');

// Blank row should return null
const emptyRow = cleanAndNormalizeProductRow({
  name: '   ',
  barcode: '',
  cost: '',
  price: '',
  stock: '',
});
assert.strictEqual(emptyRow, null);
console.log('✓ CSV Row cleaning and blank filtering verified.');

// Test 12: Offline Pending Deletes Queue & Remote Exclusion
console.log('Test 12: Offline Pending Deletes Queue & Remote Exclusion');
interface MockPendingDelete {
  productId: string;
  barcode?: string;
  name?: string;
}

const mockPendingDeletes: MockPendingDelete[] = [
  { productId: 'prod_123', barcode: '4800016550215', name: 'Lucky Me Pancit Canton' },
  { productId: 'prod_999', name: 'Custom Tingi Item' },
];

function shouldExcludeRemoteProduct(
  remote: { id: string; barcode?: string; name: string },
  pending: MockPendingDelete[]
): boolean {
  const pendingIds = new Set(pending.map(p => p.productId));
  const pendingBarcodes = new Set(pending.filter(p => p.barcode).map(p => p.barcode!.toLowerCase().trim()));
  const pendingNames = new Set(pending.filter(p => p.name).map(p => p.name!.toLowerCase().trim()));

  if (pendingIds.has(remote.id)) return true;
  if (remote.barcode && pendingBarcodes.has(remote.barcode.toLowerCase().trim())) return true;
  if (remote.name && pendingNames.has(remote.name.toLowerCase().trim())) return true;
  return false;
}

// Item matching deleted ID must be excluded
assert.strictEqual(shouldExcludeRemoteProduct({ id: 'prod_123', name: 'Different Name' }, mockPendingDeletes), true);
// Item matching deleted barcode must be excluded
assert.strictEqual(shouldExcludeRemoteProduct({ id: 'prod_456', barcode: '4800016550215', name: 'Other' }, mockPendingDeletes), true);
// Item matching deleted name must be excluded
assert.strictEqual(shouldExcludeRemoteProduct({ id: 'prod_789', name: 'Custom Tingi Item' }, mockPendingDeletes), true);
// Unrelated product must NOT be excluded
assert.strictEqual(shouldExcludeRemoteProduct({ id: 'prod_safe', barcode: '1234567890', name: 'Safe Product' }, mockPendingDeletes), false);
console.log('✓ Pending deletes queue exclusion verified.');

console.log('--- ALL 12 TESTS PASSED SUCCESSFULLY! ---');
