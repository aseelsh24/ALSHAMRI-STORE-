import { calculateTotals } from '../src/utils.js';

const resultsList = document.getElementById('test-results');
let testCount = 0;
let passCount = 0;

// Simple assertion function
function assert(condition, message) {
    testCount++;
    const li = document.createElement('li');
    if (condition) {
        passCount++;
        li.className = 'pass';
        li.textContent = `✓ PASS: ${message}`;
    } else {
        li.className = 'fail';
        li.textContent = `✗ FAIL: ${message}`;
    }
    resultsList.appendChild(li);
}

function summarize() {
    const li = document.createElement('li');
    li.innerHTML = `---<br>Tests finished: ${passCount} / ${testCount} passed.`;
    resultsList.appendChild(li);
}

// --- Test Suite ---

console.log('Running tests...');

// Test case 1: Empty cart
const emptyCart = [];
const totals1 = calculateTotals(emptyCart);
assert(totals1.subtotal === 0, 'Empty cart should have a subtotal of 0');
assert(totals1.tax === 0, 'Empty cart should have tax of 0');
assert(totals1.total === 0, 'Empty cart should have a total of 0');

// Test case 2: Cart with one item
const singleItemCart = [
    { product: { name: 'Item A' }, qty: 1, price: 10.00 }
];
const totals2 = calculateTotals(singleItemCart);
assert(totals2.subtotal === 10.00, 'Single item cart subtotal should be 10.00');
assert(totals2.tax === 1.50, 'Single item cart tax should be 1.50 (15% of 10.00)');
assert(totals2.total === 11.50, 'Single item cart total should be 11.50');

// Test case 3: Cart with multiple items and quantities
const multiItemCart = [
    { product: { name: 'Item A' }, qty: 2, price: 10.00 }, // 20.00
    { product: { name: 'Item B' }, qty: 3, price: 5.50 }  // 16.50
];
const totals3 = calculateTotals(multiItemCart);
assert(totals3.subtotal === 36.50, 'Multi-item cart subtotal should be 36.50 (20 + 16.50)');
assert(totals3.tax === 5.475, 'Multi-item cart tax should be 5.475 (15% of 36.50)');
assert(totals3.total === 41.975, 'Multi-item cart total should be 41.975');

// Test case 4: Cart with item having zero price
const zeroPriceCart = [
    { product: { name: 'Freebie' }, qty: 1, price: 0 }
];
const totals4 = calculateTotals(zeroPriceCart);
assert(totals4.total === 0, 'Cart with zero-price item should have total of 0');

summarize();
