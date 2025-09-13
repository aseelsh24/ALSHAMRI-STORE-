// Reports view module
// This file will handle the logic for generating and displaying reports.

import { saleStore } from './db.js';

const view = document.getElementById('reports-view');

// --- Helper Functions ---
function getTodayDateString() {
    // Returns date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// --- Render Functions ---
function renderDailySummary(sales) {
    const todayString = getTodayDateString();
    const todaysSales = sales.filter(s => s.createdAt.startsWith(todayString));

    const totalRevenue = todaysSales.reduce((acc, sale) => acc + sale.total, 0);
    const numberOfSales = todaysSales.length;

    return `
        <div class="card">
            <h3>ملخص المبيعات اليومي (${todayString})</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <h4>إجمالي المبيعات</h4>
                    <p>${totalRevenue.toFixed(2)} ر.س</p>
                </div>
                <div class="summary-item">
                    <h4>عدد الفواتير</h4>
                    <p>${numberOfSales}</p>
                </div>
            </div>
        </div>
    `;
}

function renderSalesTable(sales) {
    const todayString = getTodayDateString();
    const todaysSales = sales.filter(s => s.createdAt.startsWith(todayString)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (todaysSales.length === 0) {
        return '<div class="card"><p>لا توجد مبيعات لهذا اليوم.</p></div>';
    }

    return `
        <div class="card">
            <h3>فواتير اليوم</h3>
            <table>
                <thead>
                    <tr>
                        <th>وقت الفاتورة</th>
                        <th>عدد الأصناف</th>
                        <th>المجموع الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${todaysSales.map(s => `
                        <tr>
                            <td>${new Date(s.createdAt).toLocaleTimeString('ar-SA')}</td>
                            <td>${s.items.length}</td>
                            <td>${s.total.toFixed(2)} ر.س</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}


export async function render() {
  console.log('Rendering Reports view...');
  const allSales = await saleStore.getAll();

  view.innerHTML = `
    ${renderDailySummary(allSales)}
    ${renderSalesTable(allSales)}
  `;
}

// Add some specific styles for the reports view
const style = document.createElement('style');
style.textContent = `
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }
    .summary-item {
        background-color: #f9f9f9;
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
    }
    .summary-item h4 {
        margin: 0 0 0.5rem 0;
        color: #555;
    }
    .summary-item p {
        margin: 0;
        font-size: 1.8rem;
        font-weight: bold;
        color: #3498db;
    }
`;
document.head.appendChild(style);
