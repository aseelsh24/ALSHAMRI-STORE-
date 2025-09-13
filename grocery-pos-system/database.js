class DatabaseManager {
  constructor() {
    this.dbName = 'GroceryPOSDB';
    this.dbVersion = 1;
    this.db = null;
  }

  // إنشاء قاعدة البيانات
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // جدول المنتجات
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('barcode', 'barcode', { unique: true });
          productStore.createIndex('name', 'name', { unique: false });
          productStore.createIndex('category', 'category', { unique: false });
        }

        // جدول العملاء
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
          customerStore.createIndex('phone', 'phone', { unique: true });
          customerStore.createIndex('name', 'name', { unique: false });
        }

        // جدول المبيعات
        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
          salesStore.createIndex('date', 'date', { unique: false });
          salesStore.createIndex('customerId', 'customerId', { unique: false });
        }

        // جدول الموردين
        if (!db.objectStoreNames.contains('suppliers')) {
          const supplierStore = db.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
          supplierStore.createIndex('name', 'name', { unique: false });
        }

        // جدول الإعدادات
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // إضافة سجل
  async addRecord(storeName, record) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.add(record);
  }

  // تحديث سجل
  async updateRecord(storeName, record) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.put(record);
  }

  // حذف سجل
  async deleteRecord(storeName, id) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.delete(id);
  }

  // جلب جميع السجلات
  async getAllRecords(storeName) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // البحث بالفهرس
  async getByIndex(storeName, indexName, value) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.get(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // النسخ الاحتياطي
  async exportData() {
    const data = {};
    const storeNames = ['products', 'customers', 'sales', 'suppliers', 'settings'];

    for (const storeName of storeNames) {
      data[storeName] = await this.getAllRecords(storeName);
    }

    return JSON.stringify(data, null, 2);
  }

  // استيراد البيانات
  async importData(jsonData) {
    const data = JSON.parse(jsonData);
    const storeNames = Object.keys(data);

    for (const storeName of storeNames) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // مسح البيانات الموجودة
      await store.clear();

      // إضافة البيانات الجديدة
      for (const record of data[storeName]) {
        await store.add(record);
      }
    }
  }
}

// إنشاء مثيل من إدارة قاعدة البيانات
const dbManager = new DatabaseManager();
