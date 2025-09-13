class DatabaseManager {
    constructor() {
        this.dbName = 'GroceryPOSDB';
        this.dbVersion = 1;
        this.db = null;
        this.isInitialized = false;
    }

    // تهيئة قاعدة البيانات مع إصلاح الأقواس المفقودة
    async initDB() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('Upgrading database...');

                // جدول المنتجات
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                    productStore.createIndex('barcode', 'barcode', { unique: true });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category', 'category', { unique: false });
                    console.log('Products store created');
                }

                // جدول العملاء
                if (!db.objectStoreNames.contains('customers')) {
                    const customerStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                    customerStore.createIndex('phone', 'phone', { unique: true });
                    customerStore.createIndex('name', 'name', { unique: false });
                    console.log('Customers store created');
                }

                // جدول المبيعات
                if (!db.objectStoreNames.contains('sales')) {
                    const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                    salesStore.createIndex('date', 'date', { unique: false });
                    salesStore.createIndex('customerId', 'customerId', { unique: false });
                    console.log('Sales store created');
                }

                // جدول الموردين
                if (!db.objectStoreNames.contains('suppliers')) {
                    const supplierStore = db.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
                    supplierStore.createIndex('name', 'name', { unique: false });
                    console.log('Suppliers store created');
                }

                // جدول الإعدادات
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                    console.log('Settings store created');
                }

                // جدول حركات المخزون
                if (!db.objectStoreNames.contains('stockMovements')) {
                    const stockMovementStore = db.createObjectStore('stockMovements', { keyPath: 'id', autoIncrement: true });
                    stockMovementStore.createIndex('productId', 'productId', { unique: false });
                    stockMovementStore.createIndex('date', 'date', { unique: false });
                    console.log('Stock movements store created');
                }
            };
        });
    }

    // إضافة سجل مع معالجة أخطاء محسنة
    async addRecord(storeName, record) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            // Validation
            if (!storeName || !record) {
                throw new Error('Store name and record are required');
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            return await this.promisifyRequest(store.add(record));
        } catch (error) {
            console.error(`Error adding record to ${storeName}:`, error);
            throw error;
        }
    }

    // تحديث سجل
    async updateRecord(storeName, record) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            return await this.promisifyRequest(store.put(record));
        } catch (error) {
            console.error(`Error updating record in ${storeName}:`, error);
            throw error;
        }
    }

    // حذف سجل
    async deleteRecord(storeName, id) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            return await this.promisifyRequest(store.delete(id));
        } catch (error) {
            console.error(`Error deleting record from ${storeName}:`, error);
            throw error;
        }
    }

    // جلب جميع السجلات
    async getAllRecords(storeName) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);

            return await this.promisifyRequest(store.getAll());
        } catch (error) {
            console.error(`Error getting all records from ${storeName}:`, error);
            throw error;
        }
    }

    // البحث بالفهرس
    async getByIndex(storeName, indexName, value) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);

            return await this.promisifyRequest(index.get(value));
        } catch (error) {
            console.error(`Error getting record by index from ${storeName}:`, error);
            throw error;
        }
    }

    // جلب سجل واحد بالـ ID
    async getRecord(storeName, id) {
        try {
            if (!this.db) {
                await this.initDB();
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);

            return await this.promisifyRequest(store.get(id));
        } catch (error) {
            console.error(`Error getting record from ${storeName}:`, error);
            throw error;
        }
    }

    // تشفير بسيط للبيانات الحساسة
    encryptData(data) {
        try {
            return btoa(JSON.stringify(data));
        } catch (error) {
            console.error('Error encrypting data:', error);
            return data;
        }
    }

    // فك تشفير البيانات
    decryptData(encryptedData) {
        try {
            return JSON.parse(atob(encryptedData));
        } catch (error) {
            console.error('Error decrypting data:', error);
            return encryptedData;
        }
    }

    // النسخ الاحتياطي مع تشفير
    async exportData() {
        try {
            const data = {};
            const storeNames = ['products', 'customers', 'sales', 'suppliers', 'settings', 'stockMovements'];

            for (const storeName of storeNames) {
                const records = await this.getAllRecords(storeName);
                // تشفير البيانات الحساسة
                if (storeName === 'customers' || storeName === 'sales') {
                    data[storeName] = records.map(record => ({
                        ...record,
                        encrypted: true,
                        data: this.encryptData(record)
                    }));
                } else {
                    data[storeName] = records;
                }
            }

            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    // استيراد البيانات مع فك التشفير
    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            const storeNames = Object.keys(data);

            for (const storeName of storeNames) {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                // مسح البيانات الموجودة
                await this.promisifyRequest(store.clear());

                // إضافة البيانات الجديدة
                for (const record of data[storeName]) {
                    let recordToAdd = record;

                    // فك تشفير البيانات إذا كانت مشفرة
                    if (record.encrypted) {
                        recordToAdd = this.decryptData(record.data);
                    }

                    await this.promisifyRequest(store.add(recordToAdd));
                }
            }

            console.log('Data imported successfully');
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    // Helper function لتحويل requests إلى promises
    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // إغلاق قاعدة البيانات
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }

    // التحقق من حالة قاعدة البيانات
    isReady() {
        return this.isInitialized && this.db !== null;
    }
}

// إنشاء مثيل عام من إدارة قاعدة البيانات
const dbManager = new DatabaseManager();

// تصدير للاستخدام في modules أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
}
