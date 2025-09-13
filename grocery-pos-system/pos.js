class POSManager {
    constructor() {
        this.currentCart = [];
        this.currentCustomer = null;
        this.taxRate = 0.15; // 15% ضريبة
        this.onCartUpdate = null; // callback للتحديث
        this.maxQuantityPerItem = 999;
        this.minDiscountPercent = 0;
        this.maxDiscountPercent = 50;
    }

    // إضافة منتج للسلة مع validation محسن
    addToCart(product, quantity = 1) {
        try {
            // التحقق من صحة البيانات المدخلة
            if (!this.validateProduct(product)) {
                throw new Error('بيانات المنتج غير صحيحة');
            }

            if (!this.validateQuantity(quantity)) {
                throw new Error('الكمية المدخلة غير صحيحة');
            }

            if (product.quantity < quantity) {
                throw new Error(`الكمية المتوفرة في المخزون: ${product.quantity}`);
            }

            const existingItem = this.currentCart.find(item => item.id === product.id);

            if (existingItem) {
                const newQuantity = existingItem.quantity + quantity;

                if (newQuantity > this.maxQuantityPerItem) {
                    throw new Error(`الحد الأقصى للكمية: ${this.maxQuantityPerItem}`);
                }

                if (newQuantity > product.quantity) {
                    throw new Error(`الكمية المتوفرة في المخزون: ${product.quantity}`);
                }

                existingItem.quantity = newQuantity;
                existingItem.total = existingItem.quantity * existingItem.price;
            } else {
                this.currentCart.push({
                    id: product.id,
                    name: this.sanitizeString(product.name),
                    price: parseFloat(product.price),
                    quantity: quantity,
                    total: parseFloat(product.price) * quantity,
                    unit: product.unit || 'قطعة',
                    barcode: product.barcode,
                    category: product.category,
                    addedAt: new Date().toISOString()
                });
            }

            this.triggerCartUpdate();
            return true;

        } catch (error) {
            console.error('Error adding to cart:', error);
            throw error;
        }
    }

    // إزالة منتج من السلة
    removeFromCart(productId) {
        try {
            const initialLength = this.currentCart.length;
            this.currentCart = this.currentCart.filter(item => item.id !== productId);

            if (this.currentCart.length === initialLength) {
                throw new Error('المنتج غير موجود في السلة');
            }

            this.triggerCartUpdate();
            return true;

        } catch (error) {
            console.error('Error removing from cart:', error);
            throw error;
        }
    }

    // تحديث كمية في السلة مع validation
    updateQuantity(productId, quantity) {
        try {
            if (!this.validateQuantity(quantity)) {
                throw new Error('الكمية المدخلة غير صحيحة');
            }

            const item = this.currentCart.find(item => item.id === productId);

            if (!item) {
                throw new Error('المنتج غير موجود في السلة');
            }

            if (quantity === 0) {
                return this.removeFromCart(productId);
            }

            if (quantity > this.maxQuantityPerItem) {
                throw new Error(`الحد الأقصى للكمية: ${this.maxQuantityPerItem}`);
            }

            item.quantity = quantity;
            item.total = item.price * quantity;

            this.triggerCartUpdate();
            return true;

        } catch (error) {
            console.error('Error updating quantity:', error);
            throw error;
        }
    }

    // حساب مجموع السلة مع تفاصيل إضافية
    calculateCartTotal() {
        const subtotal = this.currentCart.reduce((sum, item) => sum + item.total, 0);
        const tax = subtotal * this.taxRate;
        const total = subtotal + tax;
        const itemCount = this.currentCart.reduce((sum, item) => sum + item.quantity, 0);
        const uniqueItemsCount = this.currentCart.length;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100,
            itemCount,
            uniqueItemsCount,
            averageItemPrice: itemCount > 0 ? Math.round((subtotal / itemCount) * 100) / 100 : 0
        };
    }

    // تطبيق خصم مع validation
    applyDiscount(discountPercent, reason = 'خصم عام') {
        try {
            if (discountPercent < this.minDiscountPercent || discountPercent > this.maxDiscountPercent) {
                throw new Error(`نسبة الخصم يجب أن تكون بين ${this.minDiscountPercent}% و ${this.maxDiscountPercent}%`);
            }

            const cartTotals = this.calculateCartTotal();
            const discountAmount = Math.round(cartTotals.subtotal * (discountPercent / 100) * 100) / 100;

            return {
                ...cartTotals,
                discountPercent: discountPercent,
                discountAmount: discountAmount,
                discountReason: this.sanitizeString(reason),
                finalTotal: Math.round((cartTotals.total - discountAmount) * 100) / 100
            };

        } catch (error) {
            console.error('Error applying discount:', error);
            throw error;
        }
    }

    // معالجة الدفع مع تحسينات أمنية
    async processPayment(paymentMethod, amountPaid, customerId = null, discountPercent = 0) {
        try {
            // التحقق من صحة البيانات
            if (this.currentCart.length === 0) {
                throw new Error('السلة فارغة');
            }

            if (!this.validatePaymentMethod(paymentMethod)) {
                throw new Error('طريقة الدفع غير صحيحة');
            }

            if (!this.validateAmount(amountPaid)) {
                throw new Error('المبلغ المدفوع غير صحيح');
            }

            // حساب المجاميع مع الخصم
            let cartTotals;
            if (discountPercent > 0) {
                cartTotals = this.applyDiscount(discountPercent, 'خصم على الفاتورة');
            } else {
                cartTotals = this.calculateCartTotal();
            }

            const finalAmount = cartTotals.finalTotal || cartTotals.total;

            if (amountPaid < finalAmount) {
                throw new Error(`المبلغ المدفوع أقل من المطلوب. المطلوب: ${finalAmount.toFixed(2)} ريال`);
            }

            // التحقق من توفر المخزون قبل البيع
            await this.validateInventoryAvailability();

            // إنشاء بيانات البيع
            const sale = {
                id: this.generateSaleId(),
                date: new Date().toISOString(),
                items: this.currentCart.map(item => ({...item})), // نسخة عميقة
                subtotal: cartTotals.subtotal,
                tax: cartTotals.tax,
                discountPercent: discountPercent,
                discountAmount: cartTotals.discountAmount || 0,
                total: finalAmount,
                amountPaid: amountPaid,
                change: Math.round((amountPaid - finalAmount) * 100) / 100,
                paymentMethod: this.sanitizeString(paymentMethod),
                customerId: customerId,
                receiptNumber: this.generateReceiptNumber(),
                cashierId: this.getCurrentCashierId(),
                deviceId: this.getDeviceId(),
                syncStatus: 'pending'
            };

            // حفظ عملية البيع مع تشفير البيانات الحساسة
            const encryptedSale = await this.encryptSensitiveData(sale);
            await dbManager.addRecord('sales', encryptedSale);

            // تحديث المخزون
            await this.updateInventory();

            // تحديث نقاط العميل
            if (customerId) {
                await this.updateCustomerPoints(customerId, finalAmount);
            }

            // إضافة للمزامنة إذا كان متاحاً
            if (window.offlineManager) {
                window.offlineManager.addPendingAction({
                    type: 'uploadSale',
                    data: sale
                });
            }

            // مسح السلة
            this.clearCart();

            return sale;

        } catch (error) {
            console.error('Payment processing error:', error);
            throw error;
        }
    }

    // التحقق من توفر المخزون
    async validateInventoryAvailability() {
        for (const item of this.currentCart) {
            const product = await dbManager.getByIndex('products', 'id', item.id);

            if (!product) {
                throw new Error(`المنتج ${item.name} غير موجود`);
            }

            if (product.quantity < item.quantity) {
                throw new Error(`الكمية المتوفرة من ${item.name}: ${product.quantity}`);
            }
        }
    }

    // تحديث المخزون مع تسجيل الحركات
    async updateInventory() {
        const inventoryManager = new InventoryManager();

        for (const item of this.currentCart) {
            try {
                await inventoryManager.removeStock(
                    item.id,
                    item.quantity,
                    `مبيعات - إيصال ${this.generateReceiptNumber()}`
                );
            } catch (error) {
                console.error(`Error updating inventory for ${item.name}:`, error);
                // يمكن إضافة آلية للتعامل مع أخطاء المخزون
            }
        }
    }

    // تحديث نقاط العميل مع تحسينات
    async updateCustomerPoints(customerId, totalAmount) {
        try {
            const customer = await dbManager.getByIndex('customers', 'id', customerId);

            if (customer) {
                const pointsEarned = Math.floor(totalAmount / 10); // نقطة لكل 10 ريال
                const bonusPoints = this.calculateBonusPoints(totalAmount);

                customer.loyaltyPoints = (customer.loyaltyPoints || 0) + pointsEarned + bonusPoints;
                customer.totalPurchases = (customer.totalPurchases || 0) + totalAmount;
                customer.lastPurchaseDate = new Date().toISOString();
                customer.purchaseCount = (customer.purchaseCount || 0) + 1;

                await dbManager.updateRecord('customers', customer);

                return {
                    pointsEarned: pointsEarned + bonusPoints,
                    totalPoints: customer.loyaltyPoints
                };
            }
        } catch (error) {
            console.error('Error updating customer points:', error);
        }

        return null;
    }

    // حساب النقاط الإضافية
    calculateBonusPoints(totalAmount) {
        if (totalAmount >= 500) return 50; // بونص للمشتريات الكبيرة
        if (totalAmount >= 200) return 20;
        if (totalAmount >= 100) return 10;
        return 0;
    }

    // مسح السلة
    clearCart() {
        this.currentCart = [];
        this.currentCustomer = null;
        this.triggerCartUpdate();
    }

    // تطبيق كوبون خصم
    async applyCoupon(couponCode) {
        try {
            const coupon = await dbManager.getByIndex('coupons', 'code', couponCode);

            if (!coupon) {
                throw new Error('كود الخصم غير صحيح');
            }

            if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
                throw new Error('كود الخصم منتهي الصلاحية');
            }

            if (coupon.usageCount >= coupon.maxUsage) {
                throw new Error('تم استخدام كود الخصم بالحد الأقصى');
            }

            const cartTotals = this.calculateCartTotal();

            if (cartTotals.subtotal < coupon.minOrderAmount) {
                throw new Error(`الحد الأدنى للطلب: ${coupon.minOrderAmount} ريال`);
            }

            return this.applyDiscount(coupon.discountPercent, `كوبون: ${couponCode}`);

        } catch (error) {
            console.error('Error applying coupon:', error);
            throw error;
        }
    }

    // توليد رقم البيع
    generateSaleId() {
        return `SALE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // توليد رقم الإيصال محسن
    generateReceiptNumber() {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
    }

    // طباعة الإيصال مع تحسينات
    printReceipt(sale) {
        try {
            const receiptContent = this.generateReceiptHTML(sale);
            const printWindow = window.open('', '_blank', 'width=300,height=600');

            if (!printWindow) {
                throw new Error('لا يمكن فتح نافذة الطباعة. يرجى السماح للنوافذ المنبثقة.');
            }

            printWindow.document.write(receiptContent);
            printWindow.document.close();

            // انتظار تحميل المحتوى قبل الطباعة
            printWindow.onload = () => {
                printWindow.print();
                setTimeout(() => printWindow.close(), 1000);
            };

        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    }

    // توليد HTML للإيصال محسن
    generateReceiptHTML(sale) {
        const customer = sale.customerId ? 'عميل مسجل' : 'عميل عادي';
        const changeAmount = sale.change > 0 ? `<p><strong>الباقي: ${sale.change.toFixed(2)} ريال</strong></p>` : '';
        const discountInfo = sale.discountAmount > 0 ?
            `<p>الخصم (${sale.discountPercent}%): ${sale.discountAmount.toFixed(2)} ريال</p>` : '';

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>إيصال بيع</title>
                <style>
                    body {
                        font-family: 'Courier New', monospace;
                        width: 280px;
                        margin: 0;
                        padding: 10px;
                        font-size: 12px;
                        direction: rtl;
                    }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .item { display: flex; justify-content: space-between; margin: 2px 0; }
                    .total { border-top: 2px solid #000; padding-top: 5px; margin-top: 10px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                    @media print { body { width: auto; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>بقالة الرحمة</h2>
                    <p>رقم الإيصال: ${sale.receiptNumber}</p>
                    <p>التاريخ: ${new Date(sale.date).toLocaleDateString('ar-SA')}</p>
                    <p>الوقت: ${new Date(sale.date).toLocaleTimeString('ar-SA')}</p>
                    <p>العميل: ${customer}</p>
                </div>

                <div class="items">
                    ${sale.items.map(item => `
                        <div class="item">
                            <span>${item.name}</span>
                        </div>
                        <div class="item">
                            <span>${item.quantity} × ${item.price.toFixed(2)}</span>
                            <span>${item.total.toFixed(2)} ريال</span>
                        </div>
                    `).join('')}
                </div>

                <div class="total">
                    <div class="item">
                        <span>المجموع الفرعي:</span>
                        <span>${sale.subtotal.toFixed(2)} ريال</span>
                    </div>
                    ${discountInfo}
                    <div class="item">
                        <span>الضريبة (15%):</span>
                        <span>${sale.tax.toFixed(2)} ريال</span>
                    </div>
                    <div class="item">
                        <span><strong>المجموع الكلي:</strong></span>
                        <span><strong>${sale.total.toFixed(2)} ريال</strong></span>
                    </div>
                    <div class="item">
                        <span>المبلغ المدفوع:</span>
                        <span>${sale.amountPaid.toFixed(2)} ريال</span>
                    </div>
                    ${changeAmount}
                </div>

                <div class="footer">
                    <p>شكراً لتسوقكم معنا</p>
                    <p>يرجى الاحتفاظ بالإيصال</p>
                    <p>طريقة الدفع: ${sale.paymentMethod}</p>
                </div>
            </body>
            </html>
        `;
    }

    // دوال التحقق من البيانات
    validateProduct(product) {
        return product &&
               typeof product.id !== 'undefined' &&
               product.name &&
               typeof product.price === 'number' &&
               product.price >= 0 &&
               typeof product.quantity === 'number' &&
               product.quantity >= 0;
    }

    validateQuantity(quantity) {
        return typeof quantity === 'number' &&
               quantity > 0 &&
               quantity <= this.maxQuantityPerItem &&
               Number.isInteger(quantity);
    }

    validatePaymentMethod(method) {
        const validMethods = ['cash', 'card', 'transfer', 'points'];
        return validMethods.includes(method);
    }

    validateAmount(amount) {
        return typeof amount === 'number' && amount > 0 && isFinite(amount);
    }

    // دوال مساعدة
    sanitizeString(str) {
        return str ? str.toString().trim().replace(/[<>]/g, '') : '';
    }

    triggerCartUpdate() {
        if (typeof this.onCartUpdate === 'function') {
            this.onCartUpdate();
        }
    }

    getCurrentCashierId() {
        return localStorage.getItem('currentCashierId') || 'DEFAULT_CASHIER';
    }

    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'DEVICE_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    // تشفير البيانات الحساسة
    async encryptSensitiveData(sale) {
        const sensitiveFields = ['customerId', 'amountPaid'];
        const encryptedSale = {...sale};

        sensitiveFields.forEach(field => {
            if (encryptedSale[field]) {
                encryptedSale[field] = btoa(encryptedSale[field].toString());
            }
        });

        return encryptedSale;
    }

    // الحصول على إحصائيات السلة
    getCartStats() {
        const totals = this.calculateCartTotal();
        const categories = {};

        this.currentCart.forEach(item => {
            const category = item.category || 'غير محدد';
            categories[category] = (categories[category] || 0) + item.quantity;
        });

        return {
            ...totals,
            categories,
            oldestItem: this.currentCart.length > 0 ?
                Math.min(...this.currentCart.map(item => new Date(item.addedAt))) : null,
            newestItem: this.currentCart.length > 0 ?
                Math.max(...this.currentCart.map(item => new Date(item.addedAt))) : null
        };
    }

    // حفظ السلة (لاستعادتها لاحقاً)
    saveCart() {
        try {
            const cartData = {
                items: this.currentCart,
                customer: this.currentCustomer,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('savedCart', JSON.stringify(cartData));
            return true;
        } catch (error) {
            console.error('Error saving cart:', error);
            return false;
        }
    }

    // استعادة السلة المحفوظة
    restoreCart() {
        try {
            const savedCart = localStorage.getItem('savedCart');
            if (savedCart) {
                const cartData = JSON.parse(savedCart);
                this.currentCart = cartData.items || [];
                this.currentCustomer = cartData.customer || null;
                this.triggerCartUpdate();
                localStorage.removeItem('savedCart');
                return true;
            }
        } catch (error) {
            console.error('Error restoring cart:', error);
        }
        return false;
    }
}

// إنشاء مثيل عام من إدارة نقاط البيع
const posManager = new POSManager();

// تصدير للاستخدام في modules أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = POSManager;
}
