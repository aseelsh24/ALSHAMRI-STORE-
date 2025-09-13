/**
 * @file Database module for handling all PouchDB logic.
 *
 * This file sets up local databases for different data models,
 * provides a class-based interface for CRUD operations, and
 * configures synchronization with a remote CouchDB server.
 *
 * --- DATA MODELS ---
 *
 * Product:
 * {
 *   _id: 'product_sku_12345', // Based on SKU or a UUID
 *   type: 'product',
 *   sku: '12345',
 *   name: 'خبز',
 *   price: 1.00,
 *   cost: 0.50,
 *   stock: 100,
 *   category: 'مخبوزات',
 *   barcode: '9780201379624',
 *   imageMeta: { filename: 'bread.jpg', cid: '...' }, // Optional image metadata
 *   createdAt: '2025-09-13T10:00:00Z',
 *   updatedAt: '2025-09-13T10:00:00Z'
 * }
 *
 * Customer:
 * {
 *   _id: 'customer_0501234567', // Based on phone number or a UUID
 *   type: 'customer',
 *   name: 'علي محمد',
 *   phone: '0501234567',
 *   email: 'ali.m@example.com',
 *   ledgerBalance: 0,
 *   tags: ['loyal', 'wholesale'],
 *   createdAt: '2025-09-13T10:00:00Z',
 *   updatedAt: '2025-09-13T10:00:00Z'
 * }
 *
 * Sale/Invoice:
 * {
 *   _id: 'sale_20250913_1001', // Based on timestamp or a UUID
 *   type: 'sale',
 *   items: [
 *     { productId: 'product_sku_12345', qty: 2, unitPrice: 1.00, discount: 0 },
 *     { productId: 'product_sku_67890', qty: 1, unitPrice: 5.50, discount: 0.50 }
 *   ],
 *   total: 6.50,
 *   tax: 0.98,
 *   grandTotal: 7.48,
 *   payments: [{ method: 'cash', amount: 10.00 }],
 *   status: 'paid', // paid, pending, void
 *   customerId: 'customer_0501234567', // Optional
 *   createdAt: '2025-09-13T10:01:00Z',
 *   synced: false // This flag can be updated by sync events
 * }
 *
 */

const REMOTE_COUCHDB_URL = 'http://admin:password@localhost:5984/';

class Store {
  constructor(dbName) {
    this.localDB = new PouchDB(dbName);
    this.remoteDB = new PouchDB(`${REMOTE_COUCHDB_URL}${dbName}`);

    // Start live, two-way, retrying synchronization
    this.localDB.sync(this.remoteDB, {
      live: true,
      retry: true
    }).on('change', (info) => {
      console.log(`[${dbName}] Sync change:`, info);
      // Optional: dispatch a global event to notify the UI of changes
      window.dispatchEvent(new CustomEvent('db-change', { detail: { dbName, info } }));
    }).on('error', (err) => {
      console.error(`[${dbName}] Sync error:`, err);
    });
  }

  // --- CRUD Operations ---

  async getAll() {
    try {
      const result = await this.localDB.allDocs({ include_docs: true });
      return result.rows.map(row => row.doc);
    } catch (err) {
      console.error('Error getting all documents:', err);
      return [];
    }
  }

  async get(id) {
    try {
      return await this.localDB.get(id);
    } catch (err) {
      console.error(`Error getting document '${id}':`, err);
      return null;
    }
  }

  async save(doc) {
    try {
      if (!doc.createdAt) {
        doc.createdAt = new Date().toISOString();
      }
      doc.updatedAt = new Date().toISOString();

      if (!doc._id) {
        // Create new document
        return await this.localDB.post(doc);
      } else {
        // Update existing document
        return await this.localDB.put(doc);
      }
    } catch (err) {
      console.error('Error saving document:', err);
      throw err;
    }
  }

  async remove(docOrId) {
    try {
      const doc = typeof docOrId === 'string' ? await this.localDB.get(docOrId) : docOrId;
      return await this.localDB.remove(doc);
    } catch (err) {
      console.error('Error removing document:', err);
      throw err;
    }
  }
}

// --- Database Instances ---
export const productStore = new Store('products');
export const customerStore = new Store('customers');
export const saleStore = new Store('sales');


// --- Seeding initial data ---
async function seedInitialData() {
  try {
    const products = await productStore.getAll();
    if (products.length === 0) {
      console.log('No products found. Seeding initial data...');
      await productStore.save({
        _id: 'product_sku_12345',
        type: 'product',
        name: 'خبز',
        price: 1.00,
        stock: 100,
        category: 'مخبوزات',
        barcode: '10001'
      });
      await productStore.save({
        _id: 'product_sku_67890',
        type: 'product',
        name: 'حليب طازج ١ لتر',
        price: 5.50,
        stock: 50,
        category: 'ألبان',
        barcode: '10002'
      });
       await productStore.save({
        _id: 'product_sku_11223',
        type: 'product',
        name: 'جبنة فيتا ٥٠٠ جرام',
        price: 12.00,
        stock: 30,
        category: 'ألبان',
        barcode: '10003'
      });
    }

    const customers = await customerStore.getAll();
    if (customers.length === 0) {
        console.log('No customers found. Seeding initial data...');
        await customerStore.save({
            _id: 'customer_walkin',
            type: 'customer',
            name: 'زبون عام',
            phone: '0000000000'
        });
    }

  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

// Check and seed data on startup
seedInitialData();
