class POSManager {
  constructor() {
    this.currentCart = [];
    this.currentCustomer = null;
    this.taxRate = 0.15; // 15% ضريبة
  }

  // إضافة منتج للسلة
  addToCart(product, quantity = 1) {
    const existingItem = this.currentCart.find(item => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      this.currentCart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        total: product.price * quantity,
        unit: product.unit
      });
    }

    this.updateCartDisplay();
  }

  // إزالة منتج من السلة
  removeFromCart(productId) {
    this.currentCart = this.currentCart.filter(item => item.id !== productId);
    this.updateCartDisplay();
  }

  // تحديث كمية في السلة
  updateQuantity(productId, quantity) {
    const item = this.currentCart.find(item => item.id === productId);
    if (item) {
      item.quantity = quantity;
      item.total = item.price * quantity;
      this.updateCartDisplay();
    }
  }

  // حساب مجموع السلة
  calculateCartTotal() {
    const subtotal = this.currentCart.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * this.taxRate;
    const total = subtotal + tax;

    return {
      subtotal: subtotal,
      tax: tax,
      total: total,
      itemCount: this.currentCart.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  // تطبيق خصم
  applyDiscount(discountPercent) {
    const cartTotals = this.calculateCartTotal();
    const discountAmount = cartTotals.subtotal * (discountPercent / 100);
    return {
      ...cartTotals,
      discount: discountAmount,
      finalTotal: cartTotals.total - discountAmount
    };
  }

  // معالجة الدفع
  async processPayment(paymentMethod, amountPaid, customerId = null) {
    const cartTotals = this.calculateCartTotal();

    if (amountPaid < cartTotals.total) {
      throw new Error('المبلغ المدفوع أقل من المطلوب');
    }

    const sale = {
      id: Date.now(),
      date: new Date().toISOString(),
      items: [...this.currentCart],
      subtotal: cartTotals.subtotal,
      tax: cartTotals.tax,
      total: cartTotals.total,
      amountPaid: amountPaid,
      change: amountPaid - cartTotals.total,
      paymentMethod: paymentMethod,
      customerId: customerId,
      receiptNumber: this.generateReceiptNumber()
    };

    // حفظ عملية البيع
    await dbManager.addRecord('sales', sale);

    // تحديث المخزون
    await this.updateInventory();

    // تحديث نقاط العميل
    if (customerId) {
      await this.updateCustomerPoints(customerId, cartTotals.total);
    }

    // مسح السلة
    this.clearCart();

    return sale;
  }

  // تحديث المخزون
  async updateInventory() {
    for (const item of this.currentCart) {
      const product = await dbManager.getByIndex('products', 'id', item.id);
      if (product) {
        product.quantity -= item.quantity;
        await dbManager.updateRecord('products', product);
      }
    }
  }

  // تحديث نقاط العميل
  async updateCustomerPoints(customerId, totalAmount) {
    const customer = await dbManager.getByIndex('customers', 'id', customerId);
    if (customer) {
      const pointsEarned = Math.floor(totalAmount / 10); // نقطة لكل 10 ريال
      customer.loyaltyPoints += pointsEarned;
      customer.totalPurchases += totalAmount;
      await dbManager.updateRecord('customers', customer);
    }
  }

  // مسح السلة
  clearCart() {
    this.currentCart = [];
    this.currentCustomer = null;
    this.updateCartDisplay();
  }

  // توليد رقم الإيصال
  generateReceiptNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `${dateStr}${timeStr}${Math.floor(Math.random() * 1000)}`;
  }

  // طباعة الإيصال
  printReceipt(sale) {
    const receiptContent = this.generateReceiptHTML(sale);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.print();
  }

  // توليد HTML للإيصال
  generateReceiptHTML(sale) {
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>إيصال الشراء</title>
      <style>
        body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .item { display: flex; justify-content: space-between; margin: 5px 0; }
        .total { border-top: 2px solid #000; padding-top: 10px; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🛒 بقالة الرحمة</h2>
        <p>رقم الإيصال: ${sale.receiptNumber}</p>
        <p>التاريخ: ${new Date(sale.date).toLocaleDateString('ar-SA')}</p>
        <p>الوقت: ${new Date(sale.date).toLocaleTimeString('ar-SA')}</p>
      </div>

      <div class="items">
        ${sale.items.map(item => `
          <div class="item">
            <span>${item.name} × ${item.quantity}</span>
            <span>${item.total.toFixed(2)} ريال</span>
          </div>
        `).join('')}
      </div>

      <div class="total">
        <div class="item">
          <span>المجموع الفرعي:</span>
          <span>${sale.subtotal.toFixed(2)} ريال</span>
        </div>
        <div class="item">
          <span>الضريبة (15%):</span>
          <span>${sale.tax.toFixed(2)} ريال</span>
        </div>
        <div class="item">
          <span>المجموع الكلي:</span>
          <span>${sale.total.toFixed(2)} ريال</span>
        </div>
        <div class="item">
          <span>المبلغ المدفوع:</span>
          <span>${sale.amountPaid.toFixed(2)} ريال</span>
        </div>
        <div class="item">
          <span>الباقي:</span>
          <span>${sale.change.toFixed(2)} ريال</span>
        </div>
      </div>

      <div class="footer">
        <p>شكراً لتسوقكم معنا</p>
        <p>نتطلع لخدمتكم مرة أخرى</p>
      </div>
    </body>
    </html>
    `;
  }

  // تحديث عرض السلة
  updateCartDisplay() {
    // سيتم تنفيذ هذه الوظيفة في واجهة المستخدم
    const event = new CustomEvent('cartUpdated', { detail: this.currentCart });
    document.dispatchEvent(event);
  }

  // البحث عن منتج بالباركود
  async findProductByBarcode(barcode) {
    return await dbManager.getByIndex('products', 'barcode', barcode);
  }

  // البحث عن منتج بالاسم
  async searchProductsByName(searchTerm) {
    const products = await dbManager.getAllRecords('products');
    return products.filter(product =>
      product.name.includes(searchTerm)
    );
  }
}

// إنشاء مثيل من إدارة نقطة البيع
const posManager = new POSManager();
