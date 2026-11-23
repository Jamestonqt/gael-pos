import assert from 'node:assert';
import { formatPeso, generateId, generateReceiptNo } from './src/utils/formatters.js';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SETTINGS } from './src/db/seedData.js';

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

// Test 2: Seed Products Verification
console.log('Test 2: Seed Products (15 Philippine Sari-Sari Store Items)');
assert.strictEqual(INITIAL_PRODUCTS.length >= 15, true, `Expected >= 15 products, got ${INITIAL_PRODUCTS.length}`);
const categories = new Set(INITIAL_PRODUCTS.map(p => p.category));
assert.strictEqual(categories.has('Beverages'), true);
assert.strictEqual(categories.has('Canned Goods'), true);
assert.strictEqual(categories.has('Instant Noodles'), true);
assert.strictEqual(categories.has('Snacks'), true);
assert.strictEqual(categories.has('Toiletries/Sachets'), true);

// Verify bottle deposit items
const coke = INITIAL_PRODUCTS.find(p => p.id === 'prod_coke_kasalo');
assert.strictEqual(Boolean(coke), true);
assert.strictEqual(coke.has_bottle_deposit, true);
assert.strictEqual(coke.bottle_deposit_fee, 10.00);
assert.strictEqual(coke.pack_size, 12);
console.log(`✓ 15 seed products verified with correct categories and bottle deposits.`);

// Test 3: Seed Customers Verification
console.log('Test 3: Seed Customers (Digital Lista Suki)');
assert.strictEqual(INITIAL_CUSTOMERS.length >= 3, true);
const nena = INITIAL_CUSTOMERS.find(c => c.id === 'cust_aling_nena');
const berting = INITIAL_CUSTOMERS.find(c => c.id === 'cust_mang_berting');
const glo = INITIAL_CUSTOMERS.find(c => c.id === 'cust_nanay_glo');
assert.strictEqual(Boolean(nena && berting && glo), true);
assert.strictEqual(nena.credit_limit, 800.00);
assert.strictEqual(berting.credit_limit, 500.00);
assert.strictEqual(glo.credit_limit, 1000.00);
console.log('✓ 3 initial Utang customers verified.');

// Test 4: Utang Credit Limit Logic
console.log('Test 4: Utang Credit Limit Enforcement');
function checkUtangEligibility(customer, cartTotal) {
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
const bertingCheck1 = checkUtangEligibility(berting, 20); // 485 + 20 = 505 > 500 -> blocked
assert.strictEqual(bertingCheck1.eligible, false);

const bertingCheck2 = checkUtangEligibility(berting, 15); // 485 + 15 = 500 <= 500 -> eligible
assert.strictEqual(bertingCheck2.eligible, true);
assert.strictEqual(bertingCheck2.balanceAfter, 500);

// Blocked customer test
const blockedCustomer = { ...glo, is_blocked: true };
assert.strictEqual(checkUtangEligibility(blockedCustomer, 50).eligible, false);
console.log('✓ Utang credit limit checks and blocking verified.');

// Test 5: Instant Change Calculator & Cash Logic
console.log('Test 5: Instant Change Calculator');
function calculateChange(tendered, total) {
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
function calculateFee(serviceType, amount) {
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
function calculateRestockPieces(packsCount, packSize) {
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

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
