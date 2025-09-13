// تطبيق إدارة البقالة المحسن
class GroceryApp {
    constructor() {
        this.dbManager = null;
        this.posManager = null;
        this.inventoryManager = null;
        this.offlineManager = null;
        this.allProducts = [];
        this.isInitialized = false;

        // عناصر DOM
        this.elements = {};

        // إعدادات التطبيق
        this.config = {
            searchDebounceTime: 300,
            maxRetries: 3,
            notificationTimeout: 4000
        };
    }

    // تهيئة التطبيق
    async init() {
        try {
            this.showLoadingIndicator(true);

            // تهيئة عناصر DOM
            this.initializeElements();

            // تهيئة المدراء
            await this.initializeManagers();

            // تحميل البيانات الأولية
            await this.loadInitialData();

            // تهيئة مستمعي الأحداث
            this.initializeEventListeners();

            // إضافة بيانات تجريبية إذا لم توجد منتجات
            await this.addSampleDataIfEmpty();

            this.isInitialized = true;
            this.showNotification('تم تحميل التطبيق بنجاح', 'success');

        } catch (error) {
            console.error('Error initializing app:', error);
            this.showNotification('خطأ في تهيئة التطبيق: ' + error.message, 'error');
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    // تهيئة عناصر DOM
    initializeElements() {
        this.elements = {
            productList: document.getElementById('productList'),
            cartItems: document.getElementById('cartItems'),
            subtotal: document.getElementById('subtotal'),
            tax: document.getElementById('tax'),
            total: document.getElementById('total'),
            processPaymentBtn: document.getElementById('processPaymentBtn'),
            productSearch: document.getElementById('productSearch'),
            paymentModal: document.getElementById('paymentModal'),
            paymentForm: document.getElementById('paymentForm'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            notificationContainer: document.getElementById('notificationContainer')
        };

        // التحقق من وجود العناصر المطلوبة
        const requiredElements = ['productList', 'cartItems', 'processPaymentBtn'];
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                throw new Error(`Required element not found: ${elementName}`);
            }
        }
    }

    // تهيئة المدراء
    async initializeManagers() {
        this.dbManager = new DatabaseManager();
        await this.dbManager.initDB();

        this.posManager = new POSManager();
        this.inventoryManager = new InventoryManager();
        this.offlineManager = new OfflineManager();

        // ربط callback لتحديث العرض
        this.posManager.onCartUpdate = () => this.updateCartDisplay();
    }

    // تحميل البيانات الأولية
    async loadInitialData() {
        try {
            this.allProducts = await this.inventoryManager.getAllProducts();
            this.renderProducts(this.allProducts);
            this.updateCartDisplay();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.allProducts = [];
        }
    }

    // إضافة بيانات تجريبية
    async addSampleDataIfEmpty() {
        if (this.allProducts.length === 0) {
            const sampleProducts = [
                {
                    name: 'أرز بسمتي',
                    barcode: '1234567890123',
                    price: 25.50,
                    cost: 20.00,
                    quantity: 100,
                    category: 'حبوب',
                    unit: 'كيس',
                    minStock: 10
                },
                {
                    name: 'زيت زيتون',
                    barcode: '1234567890124',
                    price: 45.00,
                    cost: 35.00,
                    quantity: 50,
                    category: 'زيوت',
                    unit: 'زجاجة',
                    minStock: 10
                },
                {
                    name: 'لحم بقري',
                    barcode: '1234567890125',
                    price: 80.00,
                    cost: 65.00,
                    quantity: 30,
                    category: 'لحوم',
                    unit: 'كيلو',
                    minStock: 5
                }
            ];

            for (const product of sampleProducts) {
                try {
                    await this.inventoryManager.addProduct(product);
                } catch (error) {
                    console.log('Sample product already exists:', product.name);
                }
            }

            this.allProducts = await this.inventoryManager.getAllProducts();
            this.renderProducts(this.allProducts);
        }
    }

    // تهيئة مستمعي الأحداث
    initializeEventListeners() {
        // البحث مع debouncing
        if (this.elements.productSearch) {
            let searchTimeout;
            this.elements.productSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, this.config.searchDebounceTime);
            });

            // مسح البحث عند الضغط على Escape
            this.elements.productSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.renderProducts(this.allProducts);
                }
            });
        }

        // زر الدفع
        if (this.elements.processPaymentBtn) {
            this.elements.processPaymentBtn.addEventListener('click', () => {
                this.openPaymentModal();
            });
        }

        // نموذج الدفع
        if (this.elements.paymentForm) {
            this.elements.paymentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePayment();
            });
        }

        // إغلاق النوافذ المنبثقة
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // اختصارات لوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'f':
                        e.preventDefault();
                        this.elements.productSearch?.focus();
                        break;
                    case 'Enter':
                        if (!e.shiftKey) {
                            e.preventDefault();
                            this.openPaymentModal();
                        }
                        break;
                }
            }
        });
    }

    // معالجة البحث
    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.renderProducts(this.allProducts);
            return;
        }

        const filteredProducts = this.allProducts.filter(product =>
            product.name.toLowerCase().includes(term) ||
            (product.barcode && product.barcode.includes(term)) ||
            (product.category && product.category.toLowerCase().includes(term))
        );

        this.renderProducts(filteredProducts);
    }

    // عرض المنتجات مع تحسين الأداء
    renderProducts(products) {
        if (!this.elements.productList) return;

        this.elements.productList.innerHTML = '';

        if (products.length === 0) {
            this.elements.productList.innerHTML = `
                <div class="no-products">
                    <p>لا توجد منتجات لعرضها.</p>
                    <button type="button" class="btn-secondary" onclick="groceryApp.elements.productSearch.value = ''; groceryApp.renderProducts(groceryApp.allProducts);">
                        عرض جميع المنتجات
                    </button>
                </div>
            `;
            return;
        }

        // استخدام DocumentFragment لتحسين الأداء
        const fragment = document.createDocumentFragment();

        products.forEach(product => {
            if (!this.validateProduct(product)) return;

            const item = document.createElement('div');
            item.className = 'product-item';
            item.dataset.productId = product.id;
            item.setAttribute('role', 'gridcell');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', `${product.name}, السعر ${product.price} ريال`);

            // تحديد حالة المخزون
            const stockStatus = product.quantity <= (product.minStock || 10) ? 'low-stock' :
                              product.quantity === 0 ? 'out-of-stock' : 'in-stock';

            item.innerHTML = `
                <h3>${this.escapeHtml(product.name)}</h3>
                <p class="price">${product.price.toFixed(2)} ريال</p>
                <p class="stock ${stockStatus}">
                    المخزون: ${product.quantity}
                    ${stockStatus === 'low-stock' ? ' (منخفض)' : ''}
                    ${stockStatus === 'out-of-stock' ? ' (غير متوفر)' : ''}
                </p>
                <div class="product-actions">
                    <button type="button" class="add-to-cart-btn" ${product.quantity === 0 ? 'disabled' : ''}>
                        إضافة للسلة
                    </button>
                </div>
            `;

            // إضافة مستمع الأحداث
            const addButton = item.querySelector('.add-to-cart-btn');
            const handleAddToCart = () => {
                if (product.quantity > 0) {
                    this.posManager.addToCart(product);
                    this.showNotification(`تم إضافة ${product.name} إلى السلة`, 'success');
                } else {
                    this.showNotification('هذا المنتج غير متوفر في المخزون', 'warning');
                }
            };

            addButton.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAddToCart();
            });

            // دعم لوحة المفاتيح
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAddToCart();
                }
            });

            item.addEventListener('click', handleAddToCart);

            fragment.appendChild(item);
        });

        this.elements.productList.appendChild(fragment);
    }

    // عرض السلة
    updateCartDisplay() {
        if (!this.elements.cartItems || !this.posManager) return;

        const cart = this.posManager.currentCart;
        this.elements.cartItems.innerHTML = '';

        if (cart.length === 0) {
            this.elements.cartItems.innerHTML = '<p class="empty-cart">السلة فارغة.</p>';
        } else {
            const fragment = document.createDocumentFragment();

            cart.forEach(item => {
                const cartItemEl = document.createElement('div');
                cartItemEl.className = 'cart-item';
                cartItemEl.innerHTML = `
                    <div class="cart-item-info">
                        <h4>${this.escapeHtml(item.name)}</h4>
                        <p class="item-price">${item.price.toFixed(2)} ريال × ${item.quantity}</p>
                        <p class="item-total">${item.total.toFixed(2)} ريال</p>
                    </div>
                    <div class="cart-item-actions">
                        <button type="button" class="qty-btn decrease" ${item.quantity <= 1 ? 'disabled' : ''}
                                aria-label="تقليل الكمية">-</button>
                        <input type="number" value="${item.quantity}" min="1" max="999"
                               class="qty-input" aria-label="الكمية">
                        <button type="button" class="qty-btn increase" aria-label="زيادة الكمية">+</button>
                        <button type="button" class="remove-btn" aria-label="إزالة ${item.name} من السلة">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                `;

                // إضافة مستمعي الأحداث
                this.addCartItemListeners(cartItemEl, item);

                fragment.appendChild(cartItemEl);
            });

            this.elements.cartItems.appendChild(fragment);
        }

        // تحديث المجاميع
        this.updateCartSummary();
    }

    // إضافة مستمعي أحداث عناصر السلة
    addCartItemListeners(cartItemEl, item) {
        const decreaseBtn = cartItemEl.querySelector('.decrease');
        const increaseBtn = cartItemEl.querySelector('.increase');
        const qtyInput = cartItemEl.querySelector('.qty-input');
        const removeBtn = cartItemEl.querySelector('.remove-btn');

        decreaseBtn.addEventListener('click', () => {
            if (item.quantity > 1) {
                this.posManager.updateQuantity(item.id, item.quantity - 1);
            }
        });

        increaseBtn.addEventListener('click', () => {
            this.posManager.updateQuantity(item.id, item.quantity + 1);
        });

        qtyInput.addEventListener('change', (e) => {
            const newQty = Math.max(1, Math.min(999, parseInt(e.target.value) || 1));
            this.posManager.updateQuantity(item.id, newQty);
        });

        removeBtn.addEventListener('click', () => {
            this.posManager.removeFromCart(item.id);
            this.showNotification(`تم إزالة ${item.name} من السلة`, 'info');
        });
    }

    // تحديث ملخص السلة
    updateCartSummary() {
        const totals = this.posManager.calculateCartTotal();

        if (this.elements.subtotal) {
            this.elements.subtotal.textContent = `${totals.subtotal.toFixed(2)} ريال`;
        }

        if (this.elements.tax) {
            this.elements.tax.textContent = `${totals.tax.toFixed(2)} ريال`;
        }

        if (this.elements.total) {
            this.elements.total.textContent = `${totals.total.toFixed(2)} ريال`;
        }

        if (this.elements.processPaymentBtn) {
            this.elements.processPaymentBtn.disabled = totals.itemCount === 0;
        }
    }

    // فتح نافذة الدفع
    openPaymentModal() {
        const totals = this.posManager.calculateCartTotal();

        if (totals.itemCount === 0) {
            this.showNotification('السلة فارغة', 'warning');
            return;
        }

        if (this.elements.paymentModal) {
            this.elements.paymentModal.style.display = 'flex';
            this.elements.paymentModal.setAttribute('aria-hidden', 'false');

            // تعيين المبلغ المطلوب
            const amountPaidInput = document.getElementById('amountPaid');
            if (amountPaidInput) {
                amountPaidInput.value = totals.total.toFixed(2);
                amountPaidInput.focus();
            }
        }
    }

    // معالجة الدفع
    async handlePayment() {
        try {
            this.showLoadingIndicator(true);

            const formData = new FormData(this.elements.paymentForm);
            const paymentMethod = formData.get('paymentMethod');
            const amountPaid = parseFloat(formData.get('amountPaid'));
            const customerPhone = formData.get('customerPhone');

            // التحقق من صحة البيانات
            const totals = this.posManager.calculateCartTotal();

            if (amountPaid < totals.total) {
                throw new Error('المبلغ المدفوع أقل من المطلوب');
            }

            // البحث عن العميل إذا تم إدخال رقم الهاتف
            let customerId = null;
            if (customerPhone) {
                const customer = await this.dbManager.getByIndex('customers', 'phone', customerPhone);
                customerId = customer?.id || null;
            }

            // معالجة الدفع
            const sale = await this.posManager.processPayment(paymentMethod, amountPaid, customerId);

            // إغلاق النافذة
            this.closeAllModals();

            // عرض رسالة نجاح
            const change = amountPaid - totals.total;
            let message = 'تم إتمام عملية البيع بنجاح';
            if (change > 0) {
                message += `\nالباقي: ${change.toFixed(2)} ريال`;
            }

            this.showNotification(message, 'success');

            // تحديث البيانات
            await this.refreshData();

            // طباعة الإيصال (اختياري)
            if (confirm('هل تريد طباعة الإيصال؟')) {
                this.posManager.printReceipt(sale);
            }

        } catch (error) {
            console.error('Payment error:', error);
            this.showNotification('خطأ في معالجة الدفع: ' + error.message, 'error');
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    // تحديث البيانات
    async refreshData() {
        try {
            this.allProducts = await this.inventoryManager.getAllProducts();
            this.renderProducts(this.allProducts);
            this.updateCartDisplay();
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    // إغلاق جميع النوافذ المنبثقة
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        });
    }

    // عرض مؤشر التحميل
    showLoadingIndicator(show) {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = show ? 'flex' : 'none';
            this.elements.loadingIndicator.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
    }

    // عرض الإشعارات المحسن
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${this.escapeHtml(message)}</span>
                <button type="button" class="notification-close" aria-label="إغلاق الإشعار">&times;</button>
            </div>
        `;

        // إضافة إلى الحاوية
        if (this.elements.notificationContainer) {
            this.elements.notificationContainer.appendChild(notification);
        } else {
            document.body.appendChild(notification);
        }

        // إضافة animation
        requestAnimationFrame(() => {
            notification.classList.add('notification--show');
        });

        // زر الإغلاق
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // إزالة تلقائية
        setTimeout(() => {
            this.removeNotification(notification);
        }, this.config.notificationTimeout);
    }

    // إزالة الإشعار
    removeNotification(notification) {
        notification.classList.remove('notification--show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    // أيقونات الإشعارات
    getNotificationIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // التحقق من صحة المنتج
    validateProduct(product) {
        if (!product || typeof product !== 'object') return false;
        if (!product.id || !product.name || product.price === undefined) return false;
        if (product.price < 0 || product.quantity < 0) return false;
        return true;
    }

    // escape HTML لمنع XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // معالج الأخطاء العام
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);

        // إرسال إلى نظام logging (إذا كان متوفراً)
        if (window.errorLogger) {
            window.errorLogger.log(error, context);
        }

        // عرض رسالة للمستخدم
        this.showNotification(`خطأ في ${context}: ${error.message}`, 'error');
    }
}

// تهيئة التطبيق عند تحميل الصفحة
let groceryApp;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        groceryApp = new GroceryApp();
        await groceryApp.init();

        // إتاحة التطبيق للنطاق العام للتطوير
        window.groceryApp = groceryApp;

    } catch (error) {
        console.error('Failed to initialize app:', error);

        // عرض رسالة خطأ للمستخدم
        const errorDiv = document.createElement('div');
        errorDiv.className = 'app-error';
        errorDiv.innerHTML = `
            <h2>خطأ في تحميل التطبيق</h2>
            <p>حدث خطأ أثناء تهيئة التطبيق. يرجى إعادة تحميل الصفحة.</p>
            <button onclick="location.reload()">إعادة التحميل</button>
        `;
        document.body.appendChild(errorDiv);
    }
});

// معالج الأخطاء العام
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (groceryApp) {
        groceryApp.handleError(event.error, 'Global');
    }
});

// معالج الـ promises المرفوضة
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (groceryApp) {
        groceryApp.handleError(event.reason, 'Promise');
    }
});
