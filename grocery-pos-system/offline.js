class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingActions = [];
    this.syncInProgress = false;

    this.initializeEventListeners();
    this.loadPendingActions();
  }

  // تهيئة مستمعي الأحداث
  initializeEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateConnectionStatus();
      this.performBackgroundSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateConnectionStatus();
    });
  }

  // تحديث حالة الاتصال في الواجهة
  updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.textContent = this.isOnline ? 'متصل' : 'غير متصل';
      statusElement.className = this.isOnline ? 'online' : 'offline';
    }

    // إظهار إشعار
    this.showConnectionNotification();
  }

  // إظهار إشعار حالة الاتصال
  showConnectionNotification() {
    const notification = document.createElement('div');
    notification.className = `notification ${this.isOnline ? 'success' : 'warning'}`;
    notification.textContent = this.isOnline ?
      'تم الاتصال بالإنترنت - جاري مزامنة البيانات' :
      'تم قطع الاتصال - سيتم العمل في وضع عدم الاتصال';

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // إضافة إجراء للقائمة المؤجلة
  addPendingAction(action) {
    const pendingAction = {
      id: Date.now() + Math.random(),
      action: action.type,
      data: action.data,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3
    };

    this.pendingActions.push(pendingAction);
    this.savePendingActions();

    // محاولة تنفيذ فوراً إذا كان هناك اتصال
    if (this.isOnline && !this.syncInProgress) {
      this.performBackgroundSync();
    }
  }

  // تنفيذ المزامنة في الخلفية
  async performBackgroundSync() {
    if (!this.isOnline || this.syncInProgress || this.pendingActions.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log('بدء مزامنة البيانات...');

    const successfulActions = [];
    const failedActions = [];

    for (const action of this.pendingActions) {
      try {
        await this.executeAction(action);
        successfulActions.push(action);
        console.log(`تم تنفيذ الإجراء: ${action.action}`);
      } catch (error) {
        action.attempts++;
        if (action.attempts >= action.maxAttempts) {
          failedActions.push(action);
          console.error(`فشل في تنفيذ الإجراء: ${action.action}`, error);
        }
      }
    }

    // إزالة الإجراءات المنفذة بنجاح
    this.pendingActions = this.pendingActions.filter(
      action => !successfulActions.includes(action)
    );

    // إزالة الإجراءات التي فشلت نهائياً
    this.pendingActions = this.pendingActions.filter(
      action => !failedActions.includes(action)
    );

    this.savePendingActions();
    this.syncInProgress = false;

    if (successfulActions.length > 0) {
      this.showSyncNotification(successfulActions.length, failedActions.length);
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

  // رفع بيانات البيع للسحابة
  async uploadSale(saleData) {
    // محاكاة API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // محاكاة نجاح أو فشل العملية
        if (Math.random() > 0.1) { // 90% نجاح
          resolve({ success: true, id: saleData.id });
        } else {
          reject(new Error('فشل في رفع البيانات'));
        }
      }, 1000);
    });
  }

  // مزامنة بيانات العميل
  async syncCustomer(customerData) {
    // محاكاة API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id: customerData.id });
      }, 500);
    });
  }

  // مزامنة بيانات المنتج
  async syncProduct(productData) {
    // محاكاة API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id: productData.id });
      }, 500);
    });
  }

  // رفع التقارير
  async uploadReport(reportData) {
    // محاكاة API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, reportId: reportData.id });
      }, 800);
    });
  }

  // حفظ الإجراءات المؤجلة
  savePendingActions() {
    localStorage.setItem('pendingActions', JSON.stringify(this.pendingActions));
  }

  // تحميل الإجراءات المؤجلة
  loadPendingActions() {
    const saved = localStorage.getItem('pendingActions');
    if (saved) {
      try {
        this.pendingActions = JSON.parse(saved);
      } catch (error) {
        console.error('خطأ في تحميل الإجراءات المؤجلة:', error);
        this.pendingActions = [];
      }
    }
  }

  // إظهار إشعار المزامنة
  showSyncNotification(successful, failed) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
      <strong>تمت المزامنة</strong><br>
      نجح: ${successful} إجراء<br>
      ${failed > 0 ? `فشل: ${failed} إجراء` : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // فرض المزامنة يدوياً
  forcSync() {
    if (this.isOnline) {
      this.performBackgroundSync();
      return true;
    } else {
      alert('لا يوجد اتصال بالإنترنت');
      return false;
    }
  }

  // جلب آخر وقت مزامنة
  getLastSyncTime() {
    return localStorage.getItem('lastSyncTime') || 'لم يتم المزامنة';
  }

  // تحديث وقت المزامنة
  updateLastSyncTime() {
    localStorage.setItem('lastSyncTime', new Date().toISOString());
  }

  // تنظيف البيانات القديمة
  cleanupOldData() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    this.pendingActions = this.pendingActions.filter(action => {
      return new Date(action.timestamp) > oneWeekAgo;
    });

    this.savePendingActions();
  }

  // الحصول على إحصائيات الإجراءات المؤجلة
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
        case 'uploadSale':
          stats.sales++;
          break;
        case 'syncCustomer':
          stats.customers++;
          break;
        case 'syncProduct':
          stats.products++;
          break;
        case 'uploadReport':
          stats.reports++;
          break;
      }
    });

    return stats;
  }
}

// إنشاء مثيل من إدارة العمل Offline
const offlineManager = new OfflineManager();

// تصدير المزامنة للتطبيقات الأخرى
window.offlineManager = offlineManager;
