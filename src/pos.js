// POS view module
// This file will handle the logic for the Point of Sale interface.

import { productStore, saleStore } from './db.js';
import { calculateTotals } from './utils.js';

const view = document.getElementById('pos-view');

// --- State Management ---
let allProducts = []; // To cache all products for searching
let cart = []; // The current shopping cart: [{ product, qty, price }]

// --- Event Handlers ---
function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    if (!query) {
        renderProductList([]); // Clear list if search is empty
        return;
    }
    const results = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query))
    );
    renderProductList(results);
}

function handleAddToCart(product) {
    const existingItem = cart.find(item => item.product._id === product._id);
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ product, qty: 1, price: product.price });
    }
    render(); // Re-render the whole view
}

function handleUpdateQty(productId, newQty) {
    const item = cart.find(item => item.product._id === productId);
    if (item) {
        if (newQty > 0) {
            item.qty = newQty;
        } else {
            // Remove item if quantity is 0 or less
            cart = cart.filter(i => i.product._id !== productId);
        }
    }
    render();
}

async function handleCompleteSale() {
    if (cart.length === 0) {
        alert('سلة المشتريات فارغة!');
        return;
    }

    const totals = calculateTotals();
    const saleDoc = {
        type: 'sale',
        _id: `sale_${Date.now()}`,
        items: cart.map(item => ({
            productId: item.product._id,
            name: item.product.name, // denormalize for easier reporting
            qty: item.qty,
            unitPrice: item.price
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        status: 'paid',
        createdAt: new Date().toISOString(),
    };

    try {
        await saleStore.save(saleDoc);

        // Decrement stock for each product sold
        for (const item of cart) {
            const product = item.product;
            product.stock -= item.qty;
            await productStore.save(product);
        }

        alert(`تمت عملية البيع بنجاح! المجموع: ${totals.total.toFixed(2)}`);
        cart = []; // Clear the cart
        allProducts = await productStore.getAll(); // Refresh product list with new stock
        render();
    } catch (err) {
        console.error("Error completing sale:", err);
        alert('حدث خطأ أثناء إتمام عملية البيع.');
    }
}


// --- Render Functions ---
function renderSearchBar(products) {
    return `
        <div class="pos-search">
            <input type="text" id="product-search" placeholder="ابحث بالاسم أو الباركود...">
            <div id="product-search-results">
                ${products.map(p => `
                    <div class="search-result-item" data-id="${p._id}">
                        <span>${p.name}</span>
                        <span>${p.price.toFixed(2)} ر.س</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderCart() {
    if (cart.length === 0) {
        return '<div class="cart-empty">سلة المشتريات فارغة</div>';
    }
    return `
        <div class="cart-items">
            ${cart.map(item => `
                <div class="cart-item">
                    <span class="item-name">${item.product.name}</span>
                    <input type="number" class="item-qty" value="${item.qty}" min="0" data-id="${item.product._id}">
                    <span class="item-price">${(item.qty * item.price).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTotals() {
    const { subtotal, tax, total } = calculateTotals();
    return `
        <div class="totals">
            <div><span>المجموع الفرعي:</span> <span>${subtotal.toFixed(2)}</span></div>
            <div><span>الضريبة (15%):</span> <span>${tax.toFixed(2)}</span></div>
            <div class="grand-total"><span>الإجمالي:</span> <span>${total.toFixed(2)}</span></div>
        </div>
        <button id="complete-sale-btn" class="btn-pay" ${cart.length === 0 ? 'disabled' : ''}>إتمام البيع (دفع)</button>
    `;
}

function renderProductList(products) {
    const resultsContainer = document.getElementById('product-search-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = products.map(p => `
        <div class="search-result-item" data-id="${p._id}">
            <span>${p.name} (${p.stock} متوفر)</span>
            <span>${p.price.toFixed(2)} ر.س</span>
        </div>
    `).join('');

    // Add event listeners to new results
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.id;
            const product = allProducts.find(p => p._id === productId);
            if (product) handleAddToCart(product);
            document.getElementById('product-search').value = '';
            renderProductList([]);
        });
    });
}

export async function render() {
  console.log('Rendering POS view...');
  // Fetch products only if the cache is empty
  if (allProducts.length === 0) {
      allProducts = await productStore.getAll();
  }

  view.innerHTML = `
    <div class="pos-grid">
      <div class="pos-main">
        ${renderSearchBar([])}
        ${renderCart()}
      </div>
      <div class="pos-sidebar">
        <div class="card">
            <h3>الفاتورة</h3>
            ${renderTotals()}
        </div>
      </div>
    </div>
  `;

  // Add main event listeners
  document.getElementById('product-search').addEventListener('input', handleSearch);
  document.getElementById('complete-sale-btn').addEventListener('click', handleCompleteSale);
  document.querySelectorAll('.item-qty').forEach(input => {
      input.addEventListener('change', (e) => {
          const productId = e.target.dataset.id;
          const newQty = parseInt(e.target.value, 10);
          handleUpdateQty(productId, newQty);
      });
  });
}

// Add some specific styles for the POS view
const style = document.createElement('style');
style.textContent = `
    .pos-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
    .pos-search input { width: 100%; padding: 0.75rem; font-size: 1.2rem; margin-bottom: 0.5rem; }
    #product-search-results { background: white; border: 1px solid #ddd; max-height: 300px; overflow-y: auto; }
    .search-result-item { padding: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; }
    .search-result-item:hover { background-color: #f0f0f0; }
    .cart-items { margin-top: 1rem; }
    .cart-item { display: flex; align-items: center; padding: 0.5rem; border-bottom: 1px solid #eee; }
    .cart-item .item-name { flex-grow: 1; }
    .cart-item .item-qty { width: 60px; text-align: center; margin: 0 1rem; }
    .totals { margin-bottom: 1rem; }
    .totals div { display: flex; justify-content: space-between; padding: 0.25rem 0; }
    .totals .grand-total { font-weight: bold; font-size: 1.5rem; border-top: 2px solid #333; margin-top: 0.5rem; padding-top: 0.5rem; }
    .btn-pay { width: 100%; padding: 1rem; font-size: 1.5rem; background-color: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; }
    .btn-pay:disabled { background-color: #95a5a6; }
`;
document.head.appendChild(style);
