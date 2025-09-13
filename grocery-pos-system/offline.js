class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingActions = [];
        this.syncInProgress = false;
        this.maxAttempts = 3;
        this.retryDelayMs = 1500;
        this.channel = null; // BroadcastChannel إن توفّر
        this.initBroadcastChannel();
        this.initializeEventListeners();
        this.loadPendingActions();
        this.updateConnectionStatus();
    }

    // تهيئة قناة بث للتواصل مع Service Worker والنوافذ الأخرى
    initBroadcastChannel() {
        try {
            if ('BroadcastChannel' in window) {
                this.channel = new BroadcastChannel('grocery-pos-channel');
                this.channel.onmessage = (event) => {
                    const { type, data } = event.data || {};
                    if (type === 'sync-completed') {
                        this.showSyncNotification(data.successful || 0, data.failed || 0);
                        this.updateLastSyncTime();
                    }
                };
            }
        } catch (e) {
            console.warn('BroadcastChannel not available');
        }
    }

    // مستمعو اتصال الشبكة
    initializeEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateConnectionStatus();
            this.performBackgroundSync();
            this.postMessageToSW({ type: 'FORCE_SYNC' });
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectionStatus();
        });
    }

    // تحديث حالة المؤشر في الواجهة
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = this.isOnline ? 'متصل' : 'غير متصل';
            statusElement.className = `connection-status ${this.isOnline ? 'online' : 'offline'}`;
        }
        this.showConnectionNotification();
    }

    // إشعار حالة الاتصال
    showConnectionNotification() {
        const container = document.getElementById('notificationContainer') || document.body;
        const notification = document.createElement('div');
        notification.className = `notification ${this.isOnline ? 'notification--success' : 'notification--warning'} notification--show`;
        notification.setAttribute('role', 'status');
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.isOnline ? '✓' : '⚠'}</span>
                <span class="notification-message">
                    ${this.isOnline ? 'تم الاتصال بالإنترنت - جاري مزامنة البيانات' : 'لا يوجد اتصال - يعمل التطبيق دون اتصال'}
                </span>
                <button type="button" class="notification-close" aria-label="إغلاق الإشعار">&times;</button>
            </div>
        `;
        container.appendChild(notification);
        notification.querySelector('.notification-close').onclick = () => notification.remove();
        setTimeout(() => notification.remove(), 3000);
    }

    // إضافة إجراء لقائمة الانتظار
    addPendingAction(action) {
        const pendingAction = {
            id: Date.now() + Math.random(),
            action: action.type,
            data: action.data,
            timestamp: new Date().toISOString(),
            attempts: 0,
            maxAttempts: this.maxAttempts
        };
        this.pendingActions.push(pendingAction);
        this.savePendingActions();
        if (this.isOnline && !this.syncInProgress) {
            this.performBackgroundSync();
        }
    }

    // مزامنة في الخلفية
    async performBackgroundSync() {
        if (!this.isOnline || this.syncInProgress || this.pendingActions.length === 0) {
            return;
        }
        this.syncInProgress = true;

        const successfulActions = [];
        const failedActions = [];

        for (const action of this.pendingActions) {
            try {
                await this.executeAction(action);
                successfulActions.push(action);
            } catch (error) {
                action.attempts++;
                if (action.attempts >= action.maxAttempts) {
                    failedActions.push(action);
                    console.error(`فشل نهائي: ${action.action}`, error);
                } else {
                    // جدولة إعادة المحاولة لاحقاً
                    await new Promise(r => setTimeout(r, this.retryDelayMs));
                }
            }
        }

        // إزالة الإجراءات الناجحة
        this.pendingActions = this.pendingActions.filter(a => !successfulActions.includes(a));
        // إزالة النهائية الفاشلة
        this.pendingActions = this.pendingActions.filter(a => !failedActions.includes(a));
        this.savePendingActions();

        this.syncInProgress = false;

        if (successfulActions.length > 0 || failedActions.length > 0) {
            this.showSyncNotification(successfulActions.length, failedActions.length);
            this.updateLastSyncTime();
        }
    }

    // تنفيذ إجراء واحد
    async executeAction(action) {
        switch (action.action) {
            case 'uploadSale':
                return await this.uploadSale(action.data);
            case 'syncCustomer':
                return await this.syncCustomer(action.data);
            case 'syncProduct':
                return await this.syncProduct(action.data);
            case 'uploadReport':
                return await this.uploadReport(action.data);
            default:
                throw new Error(`إجراء غير معروف: ${action.action}`);
        }
    }

    // محاكاة رفع بيانات البيع
    async uploadSale(saleData) {
        // هنا ضع مناداة API الحقيقية
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                Math.random() > 0.1 ? resolve(true) : reject(new Error('فشل في رفع البيع'));
            }, 600);
        });
        return { success: true, id: saleData.id };
    }

    // مزامنة عميل
    async syncCustomer(customerData) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, id: customerData.id };
    }

    // مزامنة منتج
    async syncProduct(productData) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, id: productData.id };
    }

    // رفع تقرير
    async uploadReport(reportData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, reportId: reportData.id };
    }

    // حفظ وتحميل قائمة الانتظار
    savePendingActions() {
        try {
            localStorage.setItem('pendingActions', JSON.stringify(this.pendingActions));
        } catch (e) {
            console.error('خطأ في حفظ الإجراءات المؤجلة:', e);
        }
    }

    loadPendingActions() {
        try {
            const saved = localStorage.getItem('pendingActions');
            this.pendingActions = saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('خطأ في تحميل الإجراءات المؤجلة:', error);
            this.pendingActions = [];
        }
    }

    // إشعار نتيجة المزامنة
    showSyncNotification(successful, failed) {
        const container = document.getElementById('notificationContainer') || document.body;
        const notification = document.createElement('div');
        notification.className = 'notification notification--success notification--show';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">🔁</span>
                <span class="notification-message">
                    تمت المزامنة — نجح: ${successful} — فشل: ${failed}
                </span>
                <button type="button" class="notification-close" aria-label="إغلاق الإشعار">&times;</button>
            </div>
        `;
        container.appendChild(notification);
        notification.querySelector('.notification-close').onclick = () => notification.remove();
        setTimeout(() => notification.remove(), 5000);
    }

    // فرض المزامنة يدوياً
    forceSync() {
        if (this.isOnline) {
            this.performBackgroundSync();
            this.postMessageToSW({ type: 'FORCE_SYNC' });
            return true;
        } else {
            alert('لا يوجد اتصال بالإنترنت');
            return false;
        }
    }

    // وقت آخر مزامنة
    getLastSyncTime() {
        return localStorage.getItem('lastSyncTime') || 'لم يتم المزامنة';
    }

    updateLastSyncTime() {
        localStorage.setItem('lastSyncTime', new Date().toISOString());
    }

    // تنظيف الإجراءات القديمة (أقدم من أسبوع)
    cleanupOldData() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        this.pendingActions = this.pendingActions.filter(action => {
            return new Date(action.timestamp) > oneWeekAgo;
        });
        this.savePendingActions();
    }

    // إحصائيات سريعة
    getPendingActionsStats() {
        const stats = {
            total: this.pendingActions.length,
            sales: 0,
            customers: 0,
            products: 0,
            reports: 0
        };
        this.pendingActions.forEach(action => {
            switch (action.action) {
                case 'uploadSale': stats.sales++; break;
                case 'syncCustomer': stats.customers++; break;
                case 'syncProduct': stats.products++; break;
                case 'uploadReport': stats.reports++; break;
            }
        });
        return stats;
    }

    // تواصل مع Service Worker
    postMessageToSW(message) {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(message);
        }
        if (this.channel) {
            this.channel.postMessage(message);
        }
    }
}

// إنشاء مثيل وتصديره
const offlineManager = new OfflineManager();
window.offlineManager = offlineManager;
