document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const productListEl = document.getElementById('productList');
    const cartItemsEl = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('subtotal');
    const taxEl = document.getElementById('tax');
    const totalEl = document.getElementById('total');
    const processPaymentBtn = document.getElementById('processPaymentBtn');
    const productSearchEl = document.getElementById('productSearch');

    // --- App State ---
    let allProducts = [];

    // --- Functions ---

    /**
     * Renders a list of products in the UI.
     * @param {Array} products - The array of products to render.
     */
    const renderProducts = (products) => {
        productListEl.innerHTML = '';
        if (products.length === 0) {
            productListEl.innerHTML = '<p>لا توجد منتجات لعرضها.</p>';
            return;
        }
        products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.dataset.productId = product.id;
            item.innerHTML = `
                <h3>${product.name}</h3>
                <p class="price">${product.price.toFixed(2)} ريال</p>
                <p>المخزون: ${product.quantity}</p>
            `;
            item.addEventListener('click', () => {
                if (product.quantity > 0) {
                    posManager.addToCart(product);
                } else {
                    alert('هذا المنتج غير متوفر في المخزون.');
                }
            });
            productListEl.appendChild(item);
        });
    };

    /**
     * Renders the current state of the shopping cart.
     */
    const renderCart = () => {
        const cart = posManager.currentCart;
        cartItemsEl.innerHTML = '';

        if (cart.length === 0) {
            cartItemsEl.innerHTML = '<p>السلة فارغة.</p>';
        } else {
            cart.forEach(item => {
                const cartItemEl = document.createElement('div');
                cartItemEl.className = 'cart-item';
                cartItemEl.innerHTML = `
                    <div class="cart-item-info">
                        <strong>${item.name}</strong>
                        <span>${item.price.toFixed(2)} ريال</span>
                    </div>
                    <div class="cart-item-actions">
                        <input type="number" value="${item.quantity}" min="1" data-product-id="${item.id}" class="quantity-input">
                        <button class="remove-btn" data-product-id="${item.id}">×</button>
                    </div>
                `;
                cartItemsEl.appendChild(cartItemEl);
            });
        }

        const totals = posManager.calculateCartTotal();
        subtotalEl.textContent = `${totals.subtotal.toFixed(2)} ريال`;
        taxEl.textContent = `${totals.tax.toFixed(2)} ريال`;
        totalEl.textContent = `${totals.total.toFixed(2)} ريال`;
    };

    /**
     * Handles the payment process.
     */
    const handlePayment = async () => {
        const cartTotals = posManager.calculateCartTotal();
        if (cartTotals.itemCount === 0) {
            alert('السلة فارغة. الرجاء إضافة منتجات أولاً.');
            return;
        }

        const amountPaidStr = prompt(`المبلغ الإجمالي: ${cartTotals.total.toFixed(2)} ريال. \nالرجاء إدخال المبلغ المدفوع:`, cartTotals.total.toFixed(2));
        const amountPaid = parseFloat(amountPaidStr);

        if (isNaN(amountPaid) || amountPaid < cartTotals.total) {
            alert('المبلغ المدفوع غير كافٍ أو غير صحيح.');
            return;
        }

        try {
            const sale = await posManager.processPayment('cash', amountPaid);
            alert(`تمت عملية البيع بنجاح! \nالباقي: ${sale.change.toFixed(2)} ريال`);
            posManager.printReceipt(sale);
            await loadAndRenderProducts(); // Refresh product list to show updated stock
        } catch (error) {
            console.error('فشل في معالجة الدفع:', error);
            alert(`خطأ: ${error.message}`);
        }
    };

    /**
     * Loads all products from the DB and renders them.
     */
    const loadAndRenderProducts = async () => {
        allProducts = await inventoryManager.getAllProducts();
        renderProducts(allProducts);
    };

    /**
     * Filters and renders products based on search term.
     */
    const filterProducts = () => {
        const searchTerm = productSearchEl.value.toLowerCase();
        if (!searchTerm) {
            renderProducts(allProducts);
            return;
        }
        const filtered = allProducts.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.barcode && p.barcode.includes(searchTerm))
        );
        renderProducts(filtered);
    };

    /**
     * Initializes the application.
     */
    const init = async () => {
        // 1. Initialize DB
        await dbManager.initDB();
        console.log('قاعدة البيانات جاهزة.');

        // 2. Load products and render them
        await loadAndRenderProducts();

        // 3. Add some dummy data if no products exist
        if (allProducts.length === 0) {
            console.log('لا توجد منتجات، سيتم إضافة بيانات تجريبية...');
            await inventoryManager.addProduct({ name: 'تفاح', price: 5.50, quantity: 50, barcode: '1001' });
            await inventoryManager.addProduct({ name: 'خبز', price: 2.00, quantity: 100, barcode: '1002' });
            await inventoryManager.addProduct({ name: 'حليب', price: 4.75, quantity: 30, barcode: '1003' });
            await inventoryManager.addProduct({ name: 'ماء', price: 1.00, quantity: 200, barcode: '1004' });
            await loadAndRenderProducts(); // Reload after adding data
        }

        // 4. Initial render of the cart
        renderCart();

        // 5. Setup Event Listeners
        document.addEventListener('cartUpdated', renderCart);
        processPaymentBtn.addEventListener('click', handlePayment);
        productSearchEl.addEventListener('input', filterProducts);

        cartItemsEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn')) {
                const productId = parseInt(e.target.dataset.productId);
                posManager.removeFromCart(productId);
            }
        });

        cartItemsEl.addEventListener('change', (e) => {
            if (e.target.classList.contains('quantity-input')) {
                const productId = parseInt(e.target.dataset.productId);
                const quantity = parseInt(e.target.value);
                posManager.updateQuantity(productId, quantity);
            }
        });

        // 6. Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker مسجل', reg))
                .catch(err => console.error('فشل تسجيل Service Worker', err));
        }
    };

    // --- Start Application ---
    init();
});
