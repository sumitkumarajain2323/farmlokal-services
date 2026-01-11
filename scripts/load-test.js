import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],             // Custom error rate must be below 10%
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Test data
const categories = ['Vegetables', 'Fruits', 'Grains', 'Pulses', 'Dairy', 'Herbs'];
const sortFields = ['price', 'createdAt', 'name'];
const sortOrders = ['asc', 'desc'];
const searchTerms = ['tomato', 'apple', 'rice', 'milk', 'organic'];

export default function () {
  // Test 1: Health check
  const healthResponse = http.get(`${BASE_URL.replace('/api/v1', '')}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  // Test 2: Get products with pagination
  const productsResponse = http.get(`${BASE_URL}/products?limit=20&sortBy=createdAt&sortOrder=desc`);
  check(productsResponse, {
    'products list status is 200': (r) => r.status === 200,
    'products list has data': (r) => {
      const body = JSON.parse(r.body);
      return body.success && Array.isArray(body.data);
    },
    'products list response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  // Test 3: Get products with filtering
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const filteredResponse = http.get(`${BASE_URL}/products?category=${randomCategory}&limit=10`);
  check(filteredResponse, {
    'filtered products status is 200': (r) => r.status === 200,
    'filtered products response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  // Test 4: Get products with sorting
  const randomSort = sortFields[Math.floor(Math.random() * sortFields.length)];
  const randomOrder = sortOrders[Math.floor(Math.random() * sortOrders.length)];
  const sortedResponse = http.get(`${BASE_URL}/products?sortBy=${randomSort}&sortOrder=${randomOrder}&limit=15`);
  check(sortedResponse, {
    'sorted products status is 200': (r) => r.status === 200,
    'sorted products response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  // Test 5: Search products
  const randomSearchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  const searchResponse = http.get(`${BASE_URL}/products/search?q=${randomSearchTerm}&limit=10`);
  check(searchResponse, {
    'search products status is 200': (r) => r.status === 200,
    'search products response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  // Test 6: Get specific product (if we have product IDs from previous responses)
  if (productsResponse.status === 200) {
    const productsData = JSON.parse(productsResponse.body);
    if (productsData.data && productsData.data.length > 0) {
      const randomProduct = productsData.data[Math.floor(Math.random() * productsData.data.length)];
      const productResponse = http.get(`${BASE_URL}/products/${randomProduct.id}`);
      check(productResponse, {
        'single product status is 200': (r) => r.status === 200,
        'single product response time < 100ms': (r) => r.timings.duration < 100,
      }) || errorRate.add(1);
    }
  }

  // Test 7: Get product count
  const countResponse = http.get(`${BASE_URL}/products/count`);
  check(countResponse, {
    'product count status is 200': (r) => r.status === 200,
    'product count response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  // Test 8: OAuth token info
  const tokenResponse = http.get(`${BASE_URL}/auth/token`);
  check(tokenResponse, {
    'token info status is 200': (r) => r.status === 200,
    'token info response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  // Test 9: System metrics
  const metricsResponse = http.get(`${BASE_URL}/metrics`);
  check(metricsResponse, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  // Test 10: Webhook simulation (POST request)
  const webhookPayload = {
    type: 'inventory.changed',
    data: {
      productId: Math.floor(Math.random() * 1000) + 1,
      quantityChange: Math.floor(Math.random() * 20) - 10,
      newStock: Math.floor(Math.random() * 100),
      reason: 'Load test simulation'
    },
    timestamp: new Date().toISOString()
  };

  const webhookResponse = http.post(
    `${BASE_URL}/webhooks/events`,
    JSON.stringify(webhookPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'load-test',
      },
    }
  );
  
  check(webhookResponse, {
    'webhook status is 200': (r) => r.status === 200,
    'webhook response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  // Random sleep between 1-3 seconds to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}

// Setup function (runs once per VU at the beginning)
export function setup() {
  console.log('Starting FarmLokal Backend Load Test');
  console.log(`Target URL: ${BASE_URL}`);
  
  // Verify the API is accessible
  const response = http.get(`${BASE_URL.replace('/api/v1', '')}/health`);
  if (response.status !== 200) {
    throw new Error(`API is not accessible. Health check failed with status: ${response.status}`);
  }
  
  console.log('API is accessible. Starting load test...');
  return { baseUrl: BASE_URL };
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('Load test completed');
  console.log('Check the results above for performance metrics');
}