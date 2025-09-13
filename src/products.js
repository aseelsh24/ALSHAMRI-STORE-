// Products view module
// This file will handle the logic for the product management interface (CRUD).

import { productStore } from './db.js';

const view = document.getElementById('products-view');
let currentlyEditing = null; // To hold the product being edited

// --- Event Handlers ---
async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const product = {
    type: 'product',
    name: formData.get('name'),
    sku: formData.get('sku'),
    price: parseFloat(formData.get('price')),
    stock: parseInt(formData.get('stock'), 10),
    category: formData.get('category'),
    barcode: formData.get('barcode'),
  };

  if (currentlyEditing) {
    product._id = currentlyEditing._id;
    product._rev = currentlyEditing._rev;
    product.createdAt = currentlyEditing.createdAt;
  }

  try {
    await productStore.save(product);
    console.log('Product saved successfully');
    form.reset();
    currentlyEditing = null;
    render(); // Re-render the view to show the new/updated product
  } catch (err) {
    console.error('Error saving product:', err);
    // You could show an error message to the user here
  }
}

function handleEditClick(product) {
    currentlyEditing = product;
    render(); // Re-render to populate the form
}

async function handleDeleteClick(product) {
    if (confirm(`هل أنت متأكد من حذف المنتج: ${product.name}؟`)) {
        try {
            await productStore.remove(product);
            console.log('Product deleted successfully');
            if (currentlyEditing && currentlyEditing._id === product._id) {
                currentlyEditing = null;
            }
            render(); // Re-render to remove the product from the list
        } catch (err) {
            console.error('Error deleting product:', err);
        }
    }
}


// --- Render Functions ---

function renderProductForm() {
    const isEditing = !!currentlyEditing;
    return `
        <div class="card">
            <h3>${isEditing ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
            <form id="product-form">
                <input type="text" name="name" placeholder="اسم المنتج" value="${isEditing ? currentlyEditing.name : ''}" required>
                <input type="number" step="0.01" name="price" placeholder="السعر" value="${isEditing ? currentlyEditing.price : ''}" required>
                <input type="number" name="stock" placeholder="الكمية في المخزون" value="${isEditing ? currentlyEditing.stock : ''}" required>
                <input type="text" name="category" placeholder="الفئة" value="${isEditing ? currentlyEditing.category : ''}">
                <input type="text" name="sku" placeholder="SKU (رقم التعريف)" value="${isEditing ? currentlyEditing.sku : ''}">
                <input type="text" name="barcode" placeholder="الباركود" value="${isEditing ? currentlyEditing.barcode : ''}">
                <button type="submit">${isEditing ? 'تحديث المنتج' : 'إضافة المنتج'}</button>
                ${isEditing ? `<button type="button" id="cancel-edit">إلغاء التعديل</button>` : ''}
            </form>
        </div>
    `;
}

function renderProductTable(products) {
    if (products.length === 0) {
        return '<p>لا توجد منتجات. قم بإضافة منتج جديد.</p>';
    }
    return `
        <div class="card">
            <h3>قائمة المنتجات</h3>
            <table>
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>السعر</th>
                        <th>المخزون</th>
                        <th>الفئة</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.price.toFixed(2)}</td>
                            <td>${p.stock}</td>
                            <td>${p.category || ''}</td>
                            <td class="actions">
                                <button class="edit-btn" data-id="${p._id}">تعديل</button>
                                <button class="delete-btn" data-id="${p._id}">حذف</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export async function render() {
  console.log('Rendering Products view...');
  const products = await productStore.getAll();

  view.innerHTML = `
    ${renderProductForm()}
    ${renderProductTable(products)}
  `;

  // --- Add Event Listeners after rendering ---
  document.getElementById('product-form').addEventListener('submit', handleFormSubmit);

  if (currentlyEditing) {
      document.getElementById('cancel-edit')?.addEventListener('click', () => {
          currentlyEditing = null;
          render();
      });
  }

  document.querySelectorAll('.edit-btn').forEach(button => {
      button.addEventListener('click', (e) => {
          const productId = e.target.dataset.id;
          const productToEdit = products.find(p => p._id === productId);
          if(productToEdit) handleEditClick(productToEdit);
      });
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
          const productId = e.target.dataset.id;
          const productToDelete = products.find(p => p._id === productId);
          if(productToDelete) handleDeleteClick(productToDelete);
      });
  });
}
