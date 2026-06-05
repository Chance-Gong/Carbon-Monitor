/**
 * Demo Utilities with Intentional Issues for PR Review Testing
 * This file contains various code issues that should trigger inline comments
 */

const React = require('react');

// Issue 1: Magic number - should be a named constant
function calculateDiscount(price) {
  return price * 0.15; // 15% discount hardcoded
}

// Issue 2: Missing error handling
async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// Issue 3: Inconsistent naming (camelCase vs snake_case)
function processOrder(order_id, user_name, total_amount) {
  console.log('Processing order:', order_id);
  return {
    orderId: order_id,
    userName: user_name,
    total: total_amount
  };
}

// Issue 4: Missing accessibility - button without aria-label
function ActionButton({ image, onClick }) {
  return (
    <button onClick={onClick}>
      <img src={image} alt="" />
    </button>
  );
}

// Issue 5: Inefficient algorithm - nested loops
function findDuplicates(arr1, arr2) {
  const duplicates = [];
  for (let i = 0; i < arr1.length; i++) {
    for (let j = 0; j < arr2.length; j++) {
      if (arr1[i] === arr2[j]) {
        duplicates.push(arr1[i]);
      }
    }
  }
  return duplicates;
}

// Issue 6: Hardcoded credentials (security issue)
const API_KEY = 'sk-1234567890abcdef';
const DATABASE_PASSWORD = 'admin123';

// Issue 7: Missing input validation
function divideNumbers(a, b) {
  return a / b;
}

// Issue 8: Poor variable naming
function calc(x, y, z) {
  const t = x + y;
  const r = t * z;
  return r;
}

// Issue 9: Missing JSDoc documentation
function complexBusinessLogic(data, options, callback) {
  // Complex logic here
  const result = data.map(item => {
    return item.value * options.multiplier;
  });
  callback(result);
}

// Issue 10: Memory leak potential - event listener not cleaned up
class DataFetcher {
  constructor() {
    window.addEventListener('resize', this.handleResize);
  }
  
  handleResize() {
    console.log('Window resized');
  }
}

module.exports = {
  calculateDiscount,
  fetchUserData,
  processOrder,
  ActionButton,
  findDuplicates,
  divideNumbers,
  calc,
  complexBusinessLogic,
  DataFetcher
};

// Made with Bob
