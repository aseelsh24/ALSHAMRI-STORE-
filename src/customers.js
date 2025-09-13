// Customers view module
// This file will handle the logic for the customer management interface (CRUD).

import { customerStore } from './db.js';

const view = document.getElementById('customers-view');
let currentlyEditing = null; // To hold the customer being edited

// --- Event Handlers ---
async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const customer = {
    type: 'customer',
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
  };

  if (currentlyEditing) {
    customer._id = currentlyEditing._id;
    customer._rev = currentlyEditing._rev;
    customer.createdAt = currentlyEditing.createdAt;
  } else {
    // Use phone number to create a more readable ID for new customers
    customer._id = `customer_${customer.phone || Date.now()}`;
  }


  try {
    await customerStore.save(customer);
    console.log('Customer saved successfully');
    form.reset();
    currentlyEditing = null;
    render(); // Re-render the view
  } catch (err) {
    console.error('Error saving customer:', err);
    alert('حدث خطأ أثناء حفظ العميل. قد يكون رقم الهاتف مستخدماً من قبل.');
  }
}

function handleEditClick(customer) {
    currentlyEditing = customer;
    render(); // Re-render to populate the form
}

async function handleDeleteClick(customer) {
    if (customer._id === 'customer_walkin') {
        alert('لا يمكن حذف العميل العام.');
        return;
    }
    if (confirm(`هل أنت متأكد من حذف العميل: ${customer.name}؟`)) {
        try {
            await customerStore.remove(customer);
            console.log('Customer deleted successfully');
            if (currentlyEditing && currentlyEditing._id === customer._id) {
                currentlyEditing = null;
            }
            render(); // Re-render
        } catch (err) {
            console.error('Error deleting customer:', err);
        }
    }
}


// --- Render Functions ---

function renderCustomerForm() {
    const isEditing = !!currentlyEditing;
    return `
        <div class="card">
            <h3>${isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
            <form id="customer-form">
                <input type="text" name="name" placeholder="اسم العميل" value="${isEditing ? currentlyEditing.name : ''}" required>
                <input type="tel" name="phone" placeholder="رقم الهاتف" value="${isEditing ? currentlyEditing.phone : ''}" required>
                <input type="email" name="email" placeholder="البريد الإلكتروني" value="${isEditing ? currentlyEditing.email : ''}">
                <button type="submit">${isEditing ? 'تحديث' : 'إضافة'}</button>
                ${isEditing ? `<button type="button" id="cancel-edit-customer">إلغاء</button>` : ''}
            </form>
        </div>
    `;
}

function renderCustomerTable(customers) {
    if (customers.length === 0) {
        return '<p>لا يوجد عملاء.</p>';
    }
    return `
        <div class="card">
            <h3>قائمة العملاء</h3>
            <table>
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>الهاتف</th>
                        <th>البريد الإلكتروني</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map(c => `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.phone}</td>
                            <td>${c.email || ''}</td>
                            <td class="actions">
                                <button class="edit-btn" data-id="${c._id}">تعديل</button>
                                <button class="delete-btn" data-id="${c._id}" ${c._id === 'customer_walkin' ? 'disabled' : ''}>حذف</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export async function render() {
  console.log('Rendering Customers view...');
  const customers = await customerStore.getAll();

  view.innerHTML = `
    ${renderCustomerForm()}
    ${renderCustomerTable(customers)}
  `;

  // --- Add Event Listeners after rendering ---
  document.getElementById('customer-form').addEventListener('submit', handleFormSubmit);

  if (currentlyEditing) {
      document.getElementById('cancel-edit-customer')?.addEventListener('click', () => {
          currentlyEditing = null;
          render();
      });
  }

  document.querySelectorAll('#customers-view .edit-btn').forEach(button => {
      button.addEventListener('click', (e) => {
          const customerId = e.target.dataset.id;
          const customerToEdit = customers.find(c => c._id === customerId);
          if(customerToEdit) handleEditClick(customerToEdit);
      });
  });

  document.querySelectorAll('#customers-view .delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
          const customerId = e.target.dataset.id;
          const customerToDelete = customers.find(c => c._id === customerId);
          if(customerToDelete) handleDeleteClick(customerToDelete);
      });
  });
}
