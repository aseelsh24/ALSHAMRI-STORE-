class InventoryManager {
  constructor() {
    this.lowStockThreshold = 10;
  }

  // إضافة منتج جديد
  async addProduct(productData) {
    // التحقق من عدم وجود منتج بنفس الباركود
    const existingProduct = await dbManager.getByIndex('products', 'barcode', productData.barcode);
    if (existingProduct) {
      throw new Error('يوجد منتج بنفس رقم الباركود مسبقاً');
    }

    const product = {
      ...productData,
      id: Date.now(),
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    await dbManager.addRecord('products', product);
    return product;
  }

  // تحديث منتج
  async updateProduct(productId, updateData) {
    const product = await dbManager.getByIndex('products', 'id', productId);
    if (!product) {
      throw new Error('المنتج غير موجود');
    }

    const updatedProduct = {
      ...product,
      ...updateData,
      lastUpdated: new Date().toISOString()
    };

    await dbManager.updateRecord('products', updatedProduct);
    return updatedProduct;
  }

  // حذف منتج
  async deleteProduct(productId) {
    await dbManager.deleteRecord('products', productId);
  }

  // جلب جميع المنتجات
  async getAllProducts() {
    return await dbManager.getAllRecords('products');
  }

  // جلب المنتجات منخفضة المخزون
  async getLowStockProducts() {
    const products = await this.getAllProducts();
    return products.filter(product =>
      product.quantity <= (product.minStock || this.lowStockThreshold)
    );
  }

  // جلب المنتجات منتهية الصلاحية
  async getExpiringProducts(daysAhead = 7) {
    const products = await this.getAllProducts();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    return products.filter(product => {
      if (!product.expiryDate) return false;
      const expiryDate = new Date(product.expiryDate);
      return expiryDate <= targetDate;
    });
  }

  // جلب المنتجات حسب الفئة
  async getProductsByCategory(category) {
    const products = await this.getAllProducts();
    return products.filter(product => product.category === category);
  }

  // إضافة كمية للمخزون
  async addStock(productId, quantity, reason = 'إضافة مخزون') {
    const product = await dbManager.getByIndex('products', 'id', productId);
    if (!product) {
      throw new Error('المنتج غير موجود');
    }

    product.quantity += quantity;
    product.lastUpdated = new Date().toISOString();

    // تسجيل حركة المخزون
    const stockMovement = {
      id: Date.now(),
      productId: productId,
      type: 'in',
      quantity: quantity,
      reason: reason,
      date: new Date().toISOString(),
      previousQuantity: product.quantity - quantity,
      newQuantity: product.quantity
    };

    await dbManager.updateRecord('products', product);
    await dbManager.addRecord('stockMovements', stockMovement);

    return product;
  }

  // خصم كمية من المخزون
  async removeStock(productId, quantity, reason = 'مبيعات') {
    const product = await dbManager.getByIndex('products', 'id', productId);
    if (!product) {
      throw new Error('المنتج غير موجود');
    }

    if (product.quantity < quantity) {
      throw new Error('الكمية المطلوبة غير متوفرة');
    }

    product.quantity -= quantity;
    product.lastUpdated = new Date().toISOString();

    // تسجيل حركة المخزون
    const stockMovement = {
      id: Date.now(),
      productId: productId,
      type: 'out',
      quantity: quantity,
      reason: reason,
      date: new Date().toISOString(),
      previousQuantity: product.quantity + quantity,
      newQuantity: product.quantity
    };

    await dbManager.updateRecord('products', product);
    await dbManager.addRecord('stockMovements', stockMovement);

    return product;
  }

  // حساب قيمة المخزون
  async calculateInventoryValue() {
    const products = await this.getAllProducts();
    return {
      totalCostValue: products.reduce((sum, product) => sum + (product.cost * product.quantity), 0),
      totalRetailValue: products.reduce((sum, product) => sum + (product.price * product.quantity), 0),
      totalItems: products.reduce((sum, product) => sum + product.quantity, 0),
      productsCount: products.length
    };
  }

  // تقرير حركة المخزون
  async getStockMovements(startDate, endDate) {
    const movements = await dbManager.getAllRecords('stockMovements');
    return movements.filter(movement => {
      const movementDate = new Date(movement.date);
      return movementDate >= new Date(startDate) && movementDate <= new Date(endDate);
    });
  }

  // تحديث أسعار متعددة
  async bulkUpdatePrices(updates) {
    const results = [];
    for (const update of updates) {
      try {
        const product = await this.updateProduct(update.productId, {
          price: update.newPrice,
          cost: update.newCost || undefined
        });
        results.push({ success: true, product });
      } catch (error) {
        results.push({ success: false, error: error.message, productId: update.productId });
      }
    }
    return results;
  }

  // جرد المخزون
  async performStockTake(stockTakeData) {
    const results = [];

    for (const item of stockTakeData) {
      try {
        const product = await dbManager.getByIndex('products', 'id', item.productId);
        if (!product) {
          results.push({
            success: false,
            productId: item.productId,
            error: 'المنتج غير موجود'
          });
          continue;
        }

        const difference = item.actualQuantity - product.quantity;

        if (difference !== 0) {
          product.quantity = item.actualQuantity;
          product.lastUpdated = new Date().toISOString();

          // تسجيل حركة التعديل
          const stockMovement = {
            id: Date.now() + Math.random(),
            productId: item.productId,
            type: difference > 0 ? 'in' : 'out',
            quantity: Math.abs(difference),
            reason: 'جرد مخزون',
            date: new Date().toISOString(),
            previousQuantity: product.quantity - difference,
            newQuantity: product.quantity
          };

          await dbManager.updateRecord('products', product);
          await dbManager.addRecord('stockMovements', stockMovement);
        }

        results.push({
          success: true,
          productId: item.productId,
          difference: difference,
          product: product
        });

      } catch (error) {
        results.push({
          success: false,
          productId: item.productId,
          error: error.message
        });
      }
    }

    return results;
  }

  // توليد تقرير المنتجات الأكثر مبيعاً
  async getBestSellingProducts(startDate, endDate, limit = 10) {
    const sales = await dbManager.getAllRecords('sales');

    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });

    const productSales = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSales[item.id]) {
          productSales[item.id] = {
            id: item.id,
            name: item.name,
            totalQuantity: 0,
            totalRevenue: 0
          };
        }
        productSales[item.id].totalQuantity += item.quantity;
        productSales[item.id].totalRevenue += item.total;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }
}

// إنشاء مثيل من إدارة المخزون
const inventoryManager = new InventoryManager();
