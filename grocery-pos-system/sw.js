// إعدادات Service Worker محسنة
const CACHE_NAME = 'grocery-pos-v2.0.0';
const STATIC_CACHE = 'static-v2.0.0';
const DATA_CACHE = 'data-v2.0.0';
const IMAGE_CACHE = 'images-v2.0.0';

// الملفات للتخزين المؤقت
const STATIC_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/database.js',
    '/pos.js',
    '/inventory.js',
    '/offline.js',
    '/manifest.json'
];

const FONT_FILES = [
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap'
];

const ICON_FILES = [
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-152.png',
    '/icons/icon-192.png',
    '/icons/icon-384.png',
    '/icons/icon-512.png'
];

// استراتيجيات التخزين المؤقت
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only',
    CACHE_ONLY: 'cache-only'
};

// تثبيت Service Worker
self.addEventListener('install', event => {
    console.log('SW: Installing Service Worker...');

    event.waitUntil(
        Promise.all([
            // تخزين الملفات الثابتة
            caches.open(STATIC_CACHE).then(cache => {
                console.log('SW: Caching static files');
                return cache.addAll([...STATIC_FILES, ...FONT_FILES]);
            }),

            // تخزين الأيقونات
            caches.open(IMAGE_CACHE).then(cache => {
                console.log('SW: Caching icons');
                return cache.addAll(ICON_FILES).catch(error => {
                    console.warn('SW: Some icons failed to cache:', error);
                });
            }),

            // تخزين صفحة offline
            caches.open(STATIC_CACHE).then(cache => {
                return cache.add('/offline.html').catch(() => {
                    console.warn('SW: Offline page not found, creating fallback');
                    return cache.put('/offline.html', new Response(
                        createOfflinePage(),
                        { headers: { 'Content-Type': 'text/html' } }
                    ));
                });
            })
        ]).then(() => {
            console.log('SW: Installation completed');
            return self.skipWaiting();
        })
    );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
    console.log('SW: Activating Service Worker...');

    event.waitUntil(
        Promise.all([
            // حذف التخزين المؤقت القديم
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE &&
                            cacheName !== DATA_CACHE &&
                            cacheName !== IMAGE_CACHE) {
                            console.log('SW: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),

            // التحكم في جميع العملاء
            self.clients.claim()
        ]).then(() => {
            console.log('SW: Activation completed');
        })
    );
});

// التعامل مع طلبات الشبكة
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // تجاهل طلبات chrome-extension
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // تحديد الاستراتيجية حسب نوع الطلب
    if (request.method !== 'GET') {
        // طلبات POST/PUT/DELETE - شبكة فقط
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Network unavailable' }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    // تحديد الاستراتيجية حسب المسار
    if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
    } else if (isAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(request));
    } else if (isNavigationRequest(request)) {
        event.respondWith(handleNavigationRequest(request));
    } else {
        event.respondWith(handleDefaultRequest(request));
    }
});

// معالجة الأصول الثابتة (Cache First)
async function handleStaticAsset(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('SW: Static asset error:', error);
        return caches.match('/offline.html');
    }
}

// معالجة طلبات API (Network First مع Cache Fallback)
async function handleAPIRequest(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(DATA_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('SW: Network failed, trying cache for:', request.url);

        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        return new Response(
            JSON.stringify({
                error: 'Data unavailable offline',
                cached: false
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// معالجة الصور (Cache First مع Network Fallback)
async function handleImageRequest(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(IMAGE_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // إرجاع صورة افتراضية
        return caches.match('/icons/icon-192.png') ||
               new Response('', { status: 404 });
    }
}

// معالجة طلبات التنقل (Stale While Revalidate)
async function handleNavigationRequest(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);

        const networkPromise = fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        }).catch(() => null);

        return cachedResponse || await networkPromise || await cache.match('/offline.html');
    } catch (error) {
        console.error('SW: Navigation error:', error);
        return caches.match('/offline.html');
    }
}

// معالجة الطلبات الافتراضية
async function handleDefaultRequest(request) {
    try {
        return await fetch(request);
    } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('', { status: 404 });
    }
}

// التحقق من نوع الطلب
function isStaticAsset(url) {
    return url.pathname.match(/\.(css|js|woff2?|ttf|eot)$/);
}

function isAPIRequest(url) {
    return url.pathname.startsWith('/api/') ||
           url.pathname.includes('sync') ||
           url.hostname !== self.location.hostname;
}

function isImageRequest(url) {
    return url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/);
}

function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
           (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// مزامنة البيانات في الخلفية
self.addEventListener('sync', event => {
    console.log('SW: Background sync triggered:', event.tag);

    if (event.tag === 'background-sync') {
        event.waitUntil(performBackgroundSync());
    } else if (event.tag === 'sales-sync') {
        event.waitUntil(syncSalesData());
    } else if (event.tag === 'inventory-sync') {
        event.waitUntil(syncInventoryData());
    }
});

// تنفيذ المزامنة الخلفية
async function performBackgroundSync() {
    try {
        console.log('SW: Starting background sync...');

        const results = await Promise.allSettled([
            syncSalesData(),
            syncInventoryData(),
            syncCustomerData(),
            cleanupOldCache()
        ]);

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`SW: Background sync completed. Success: ${successful}, Failed: ${failed}`);

        // إشعار العميل بنتيجة المزامنة
        await notifyClients('sync-completed', { successful, failed });

    } catch (error) {
        console.error('SW: Background sync failed:', error);
    }
}

// مزامنة بيانات المبيعات
async function syncSalesData() {
    try {
        // محاكاة مزامنة المبيعات
        const salesData = await getStoredData('sales');

        for (const sale of salesData) {
            if (sale.syncStatus === 'pending') {
                await uploadSaleToServer(sale);
                sale.syncStatus = 'synced';
                await updateStoredData('sales', sale);
            }
        }

        console.log('SW: Sales data synced successfully');
    } catch (error) {
        console.error('SW: Sales sync failed:', error);
        throw error;
    }
}

// مزامنة بيانات المخزون
async function syncInventoryData() {
    try {
        // محاكاة مزامنة المخزون
        const inventoryData = await getStoredData('products');

        // تحديث أسعار المنتجات من الخادم
        const updatedPrices = await fetchUpdatedPrices();

        for (const product of inventoryData) {
            const updatedPrice = updatedPrices.find(p => p.id === product.id);
            if (updatedPrice && updatedPrice.price !== product.price) {
                product.price = updatedPrice.price;
                product.lastUpdated = new Date().toISOString();
                await updateStoredData('products', product);
            }
        }

        console.log('SW: Inventory data synced successfully');
    } catch (error) {
        console.error('SW: Inventory sync failed:', error);
        throw error;
    }
}

// مزامنة بيانات العملاء
async function syncCustomerData() {
    try {
        const customersData = await getStoredData('customers');

        for (const customer of customersData) {
            if (customer.syncStatus === 'pending') {
                await uploadCustomerToServer(customer);
                customer.syncStatus = 'synced';
                await updateStoredData('customers', customer);
            }
        }

        console.log('SW: Customer data synced successfully');
    } catch (error) {
        console.error('SW: Customer sync failed:', error);
        throw error;
    }
}

// تنظيف التخزين المؤقت القديم
async function cleanupOldCache() {
    try {
        const cacheNames = await caches.keys();
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        for (const cacheName of cacheNames) {
            if (cacheName.includes('data-') || cacheName.includes('api-')) {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();

                for (const request of requests) {
                    const response = await cache.match(request);
                    const dateHeader = response.headers.get('date');

                    if (dateHeader && new Date(dateHeader).getTime() < oneWeekAgo) {
                        await cache.delete(request);
                    }
                }
            }
        }

        console.log('SW: Cache cleanup completed');
    } catch (error) {
        console.error('SW: Cache cleanup failed:', error);
    }
}

// دعم الإشعارات المحسن
self.addEventListener('push', event => {
    console.log('SW: Push notification received');

    const options = {
        body: 'لديك إشعار جديد من تطبيق البقالة',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        vibrate: [100, 50, 100],
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: false,
        actions: [
            {
                action: 'open',
                title: 'فتح التطبيق',
                icon: '/icons/icon-72.png'
            },
            {
                action: 'dismiss',
                title: 'رفض',
                icon: '/icons/icon-72.png'
            }
        ],
        data: {
            url: '/',
            timestamp: Date.now()
        }
    };

    if (event.data) {
        try {
            const data = event.data.json();
            options.title = data.title || 'نظام إدارة البقالة';
            options.body = data.body || options.body;
            options.icon = data.icon || options.icon;
            options.data = { ...options.data, ...data };
        } catch (error) {
            console.error('SW: Error parsing push data:', error);
            options.title = 'نظام إدارة البقالة';
        }
    } else {
        options.title = 'نظام إدارة البقالة';
    }

    event.waitUntil(
        self.registration.showNotification(options.title, options)
    );
});

// معالجة النقر على الإشعارات
self.addEventListener('notificationclick', event => {
    console.log('SW: Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clients => {
            // البحث عن نافذة مفتوحة
            for (const client of clients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }

            // فتح نافذة جديدة
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});

// معالجة رسائل من العميل
self.addEventListener('message', event => {
    console.log('SW: Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'GET_CACHE_STATUS') {
        getCacheStatus().then(status => {
            event.ports[0].postMessage(status);
        });
    } else if (event.data && event.data.type === 'CLEAR_CACHE') {
        clearAllCache().then(result => {
            event.ports[0].postMessage(result);
        });
    } else if (event.data && event.data.type === 'FORCE_SYNC') {
        performBackgroundSync().then(() => {
            event.ports[0].postMessage({ success: true });
        }).catch(error => {
            event.ports[0].postMessage({ success: false, error: error.message });
        });
    }
});

// دوال مساعدة
async function getStoredData(storeName) {
    // محاكاة جلب البيانات من IndexedDB
    return [];
}

async function updateStoredData(storeName, data) {
    // محاكاة تحديث البيانات في IndexedDB
    return true;
}

async function uploadSaleToServer(sale) {
    // محاكاة رفع بيانات البيع للخادم
    return new Promise(resolve => setTimeout(resolve, 1000));
}

async function uploadCustomerToServer(customer) {
    // محاكاة رفع بيانات العميل للخادم
    return new Promise(resolve => setTimeout(resolve, 500));
}

async function fetchUpdatedPrices() {
    // محاكاة جلب الأسعار المحدثة من الخادم
    return [];
}

async function notifyClients(type, data) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type, data });
    });
}

async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = keys.length;
    }

    return status;
}

async function clearAllCache() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        return { success: true, cleared: cacheNames.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// إنشاء صفحة offline
function createOfflinePage() {
    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>غير متصل - نظام إدارة البقالة</title>
            <style>
                body {
                    font-family: 'Tajawal', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                    padding: 2rem;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                }
                .offline-container {
                    max-width: 400px;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 2rem;
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
                }
                h1 { font-size: 2rem; margin-bottom: 1rem; }
                p { font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem; }
                button {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    padding: 0.75rem 1.5rem;
                    border-radius: 50px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                }
                button:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <h1>🌐 غير متصل</h1>
                <p>يبدو أنك غير متصل بالإنترنت. لا تقلق، يمكنك الاستمرار في استخدام التطبيق في وضع عدم الاتصال.</p>
                <button onclick="location.reload()">إعادة المحاولة</button>
            </div>
        </body>
        </html>
    `;
}

console.log('SW: Service Worker script loaded');
