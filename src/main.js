// Main application entry point
// This file will handle UI routing, register the service worker,
// and orchestrate the different modules.

import { render as renderPos } from './pos.js';
import { render as renderProducts } from './products.js';
import { render as renderCustomers } from './customers.js';
import { render as renderReports } from './reports.js';

console.log('Main application script loaded.');

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// --- Simple SPA Routing ---
const navButtons = {
  pos: document.getElementById('nav-pos'),
  products: document.getElementById('nav-products'),
  customers: document.getElementById('nav-customers'),
  reports: document.getElementById('nav-reports'),
};

const views = {
  pos: document.getElementById('pos-view'),
  products: document.getElementById('products-view'),
  customers: document.getElementById('customers-view'),
  reports: document.getElementById('reports-view'),
};

const renderers = {
    pos: renderPos,
    products: renderProducts,
    customers: renderCustomers,
    reports: renderReports,
};

function navigateTo(viewName) {
  console.log(`Navigating to ${viewName}`);
  // Hide all views and deactivate all buttons
  Object.values(views).forEach(view => view.classList.remove('active'));
  Object.values(navButtons).forEach(button => button.classList.remove('active'));

  // Show the target view and activate its button
  views[viewName].classList.add('active');
  navButtons[viewName].classList.add('active');

  // Render the content for the view
  if(renderers[viewName]) {
      renderers[viewName]();
  }
}

// Add event listeners to navigation buttons
Object.keys(navButtons).forEach(viewName => {
  navButtons[viewName].addEventListener('click', () => navigateTo(viewName));
});

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial navigation to the default view (POS)
    navigateTo('pos');

    // Listen for database changes to re-render the active view
    window.addEventListener('db-change', () => {
        const activeViewName = document.querySelector('.view.active')?.id.replace('-view', '');
        if (activeViewName && renderers[activeViewName]) {
            console.log(`Database change detected, re-rendering '${activeViewName}' view.`);
            renderers[activeViewName]();
        }
    });
});
