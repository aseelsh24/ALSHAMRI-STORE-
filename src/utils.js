// Utility functions shared across the application.

/**
 * Calculates subtotal, tax, and total for a given cart.
 * @param {Array} cart - The shopping cart array.
 * @returns {{subtotal: number, tax: number, total: number}}
 */
export function calculateTotals(cart) {
    const subtotal = cart.reduce((acc, item) => acc + (item.qty * item.price), 0);
    const taxRate = 0.15; // 15% VAT, should be a setting in a real app
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
}
