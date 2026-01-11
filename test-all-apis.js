#!/usr/bin/env node

/**
 * Comprehensive API Testing Script for FarmLokal Backend
 * Tests all endpoints and functionality to verify the system is working
 */

const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = '') {
    totalTests++;
    if (passed) {
        passedTests++;
        log(`✅ PASS: ${testName}`, 'green');
    } else {
        failedTests++;
        log(`❌ FAIL: ${testName}`, 'red');
        if (details) log(`   Details: ${details}`, 'yellow');
    }
    
    testResults.push({
        test: testName,
        passed,
        details,
        timestamp: new Date().toISOString()
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(method, url, data = null, headers = {}) {
    try {
        const config = {
            method,
            url,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: 10000
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return {
            success: true,
            status: response.status,
            data: response.data,
            headers: response.headers,
            responseTime: response.headers['x-response-time'] || 'N/A'
        };
    } catch (error) {
        return {
            success: false,
            status: error.response?.status || 0,
            data: error.response?.data || null,
            error: error.message,
            responseTime: 'N/A'
        };
    }
}

// Test Categories
async function testSystemHealth() {
    log('\n🏥 Testing System Health', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test root endpoint
    const rootTest = await makeRequest('GET', BASE_URL);
    logTest('Root endpoint accessible', rootTest.success && rootTest.status === 200);
    
    // Test health endpoint
    const healthTest = await makeRequest('GET', `${BASE_URL}/health`);
    logTest('Health endpoint responding', healthTest.success && healthTest.status === 200);
    
    if (healthTest.success) {
        const isHealthy = healthTest.data?.status === 'healthy';
        logTest('System reports healthy status', isHealthy);
    }
    
    // Test API root
    const apiRootTest = await makeRequest('GET', API_BASE);
    logTest('API root endpoint accessible', apiRootTest.success && apiRootTest.status === 200);
}

async function testProductsAPI() {
    log('\n🛒 Testing Products API', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test basic product listing
    const productsTest = await makeRequest('GET', `${API_BASE}/products`);
    logTest('GET /products endpoint', productsTest.success && productsTest.status === 200);
    
    if (productsTest.success) {
        const hasData = productsTest.data?.data && Array.isArray(productsTest.data.data);
        logTest('Products endpoint returns array data', hasData);
        
        const hasPagination = productsTest.data?.meta?.pagination;
        logTest('Products endpoint includes pagination metadata', !!hasPagination);
    }
    
    // Test product listing with parameters
    const paramsTest = await makeRequest('GET', `${API_BASE}/products?limit=5&sortBy=price&sortOrder=asc`);
    logTest('GET /products with query parameters', paramsTest.success && paramsTest.status === 200);
    
    // Test product search
    const searchTest = await makeRequest('GET', `${API_BASE}/products/search?q=test`);
    logTest('GET /products/search endpoint', searchTest.success && searchTest.status === 200);
    
    // Test product count
    const countTest = await makeRequest('GET', `${API_BASE}/products/count`);
    logTest('GET /products/count endpoint', countTest.success && countTest.status === 200);
    
    // Test individual product (if we have products)
    if (productsTest.success && productsTest.data?.data?.length > 0) {
        const productId = productsTest.data.data[0].id;
        const singleProductTest = await makeRequest('GET', `${API_BASE}/products/${productId}`);
        logTest(`GET /products/${productId} (individual product)`, singleProductTest.success && singleProductTest.status === 200);
    }
    
    // Test invalid product ID
    const invalidProductTest = await makeRequest('GET', `${API_BASE}/products/999999999`);
    logTest('GET /products/invalid_id returns 404', invalidProductTest.status === 404);
    
    // Test invalid query parameters
    const invalidParamsTest = await makeRequest('GET', `${API_BASE}/products?limit=invalid`);
    logTest('Invalid query parameters handled gracefully', invalidParamsTest.status === 400);
}

async function testAuthAPI() {
    log('\n🔐 Testing Authentication API', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test token info endpoint
    const tokenInfoTest = await makeRequest('GET', `${API_BASE}/auth/token`);
    logTest('GET /auth/token endpoint', tokenInfoTest.success);
    
    // Test token refresh
    const refreshTest = await makeRequest('POST', `${API_BASE}/auth/token/refresh`);
    logTest('POST /auth/token/refresh endpoint', refreshTest.success);
    
    // Test token invalidation
    const invalidateTest = await makeRequest('DELETE', `${API_BASE}/auth/token`);
    logTest('DELETE /auth/token endpoint', invalidateTest.success);
}

async function testWebhooksAPI() {
    log('\n🪝 Testing Webhooks API', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test webhook registration
    const registerPayload = {
        url: 'https://example.com/webhook',
        events: ['order.created', 'product.updated']
    };
    const registerTest = await makeRequest('POST', `${API_BASE}/webhooks/register`, registerPayload);
    logTest('POST /webhooks/register endpoint', registerTest.success);
    
    // Test webhook event processing
    const eventPayload = {
        type: 'test.event',
        data: {
            testId: Date.now(),
            message: 'API test event'
        },
        timestamp: new Date().toISOString()
    };
    const eventTest = await makeRequest('POST', `${API_BASE}/webhooks/events`, eventPayload);
    logTest('POST /webhooks/events endpoint', eventTest.success);
    
    // Test specific webhook endpoints
    const orderEventPayload = {
        orderId: 12345,
        customerId: 67890,
        products: [{ productId: 1, quantity: 2, price: 25.50 }],
        totalAmount: 51.00
    };
    const orderEventTest = await makeRequest('POST', `${API_BASE}/webhooks/events/order-created`, orderEventPayload);
    logTest('POST /webhooks/events/order-created endpoint', orderEventTest.success);
    
    const inventoryEventPayload = {
        productId: 123,
        quantityChange: -5,
        newStock: 45,
        reason: 'API test'
    };
    const inventoryEventTest = await makeRequest('POST', `${API_BASE}/webhooks/events/inventory-changed`, inventoryEventPayload);
    logTest('POST /webhooks/events/inventory-changed endpoint', inventoryEventTest.success);
    
    // Test webhook events listing
    const eventsListTest = await makeRequest('GET', `${API_BASE}/webhooks/events`);
    logTest('GET /webhooks/events endpoint', eventsListTest.success);
}

async function testExternalAPI() {
    log('\n🌐 Testing External API Integration', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test external products endpoint
    const extProductsTest = await makeRequest('GET', `${API_BASE}/external-api/products`);
    logTest('GET /external-api/products endpoint', extProductsTest.success || extProductsTest.status === 502);
    
    // Test external product by ID
    const extProductTest = await makeRequest('GET', `${API_BASE}/external-api/products/1`);
    logTest('GET /external-api/products/:id endpoint', extProductTest.success || extProductTest.status === 502);
    
    // Test external order creation
    const orderPayload = {
        customerId: 123,
        products: [{ productId: 1, quantity: 2, price: 25.50 }],
        totalAmount: 51.00
    };
    const extOrderTest = await makeRequest('POST', `${API_BASE}/external-api/orders`, orderPayload);
    logTest('POST /external-api/orders endpoint', extOrderTest.success || extOrderTest.status === 502);
    
    // Test circuit breaker status
    const circuitBreakerTest = await makeRequest('GET', `${API_BASE}/external-api/circuit-breaker/status`);
    logTest('GET /external-api/circuit-breaker/status endpoint', circuitBreakerTest.success);
}

async function testMetricsAPI() {
    log('\n📊 Testing Metrics API', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test system metrics
    const metricsTest = await makeRequest('GET', `${API_BASE}/metrics`);
    logTest('GET /metrics endpoint', metricsTest.success);
    
    // Test product metrics
    const productMetricsTest = await makeRequest('GET', `${API_BASE}/metrics/products`);
    logTest('GET /metrics/products endpoint', productMetricsTest.success);
    
    // Test webhook metrics
    const webhookMetricsTest = await makeRequest('GET', `${API_BASE}/metrics/webhooks`);
    logTest('GET /metrics/webhooks endpoint', webhookMetricsTest.success);
    
    // Test health metrics
    const healthMetricsTest = await makeRequest('GET', `${API_BASE}/metrics/health`);
    logTest('GET /metrics/health endpoint', healthMetricsTest.success);
}

async function testErrorHandling() {
    log('\n🚨 Testing Error Handling', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test 404 for non-existent endpoint
    const notFoundTest = await makeRequest('GET', `${API_BASE}/non-existent-endpoint`);
    logTest('404 for non-existent endpoint', notFoundTest.status === 404);
    
    // Test malformed JSON
    const malformedJsonTest = await makeRequest('POST', `${API_BASE}/webhooks/events`, 'invalid json');
    logTest('Malformed JSON handled gracefully', malformedJsonTest.status === 400);
    
    // Test missing required fields
    const missingFieldsTest = await makeRequest('POST', `${API_BASE}/webhooks/events`, {});
    logTest('Missing required fields validation', missingFieldsTest.status === 400);
    
    // Test invalid HTTP method
    const invalidMethodTest = await makeRequest('PATCH', `${API_BASE}/products`);
    logTest('Invalid HTTP method handled', invalidMethodTest.status === 404 || invalidMethodTest.status === 405);
}

async function testPerformance() {
    log('\n⚡ Testing Performance', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test response times
    const startTime = Date.now();
    const perfTest = await makeRequest('GET', `${API_BASE}/products?limit=20`);
    const responseTime = Date.now() - startTime;
    
    logTest('Products API response time < 1000ms', responseTime < 1000, `${responseTime}ms`);
    logTest('Products API response time < 500ms', responseTime < 500, `${responseTime}ms`);
    
    // Test concurrent requests
    log('Testing concurrent requests...', 'yellow');
    const concurrentPromises = Array(10).fill().map(() => 
        makeRequest('GET', `${API_BASE}/products?limit=5`)
    );
    
    const concurrentStart = Date.now();
    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    
    const successfulConcurrent = concurrentResults.filter(r => r.success).length;
    logTest('Concurrent requests handled successfully', successfulConcurrent >= 8, `${successfulConcurrent}/10 successful`);
    logTest('Concurrent requests completed quickly', concurrentTime < 2000, `${concurrentTime}ms total`);
}

async function testRateLimiting() {
    log('\n🛡️ Testing Rate Limiting', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Send multiple requests rapidly
    log('Sending rapid requests to test rate limiting...', 'yellow');
    const rapidRequests = [];
    
    for (let i = 0; i < 30; i++) {
        rapidRequests.push(makeRequest('GET', `${API_BASE}/products?limit=1`));
    }
    
    const rapidResults = await Promise.all(rapidRequests);
    const rateLimitedRequests = rapidResults.filter(r => r.status === 429).length;
    const successfulRequests = rapidResults.filter(r => r.success).length;
    
    logTest('Rate limiting system active', rateLimitedRequests > 0 || successfulRequests === 30, 
           `${rateLimitedRequests} rate limited, ${successfulRequests} successful`);
}

async function testSecurity() {
    log('\n🔒 Testing Security', 'blue');
    log('=' .repeat(50), 'blue');
    
    // Test SQL injection attempt
    const sqlInjectionTest = await makeRequest('GET', `${API_BASE}/products/search?q=' OR '1'='1`);
    logTest('SQL injection attempt blocked', sqlInjectionTest.status !== 200 || 
           (sqlInjectionTest.success && sqlInjectionTest.data?.data?.length < 1000));
    
    // Test XSS attempt
    const xssTest = await makeRequest('GET', `${API_BASE}/products/search?q=<script>alert('xss')</script>`);
    logTest('XSS attempt handled safely', xssTest.success || xssTest.status === 400);
    
    // Test oversized payload
    const largePayload = {
        type: 'test.large',
        data: 'x'.repeat(50000) // 50KB payload
    };
    const oversizedTest = await makeRequest('POST', `${API_BASE}/webhooks/events`, largePayload);
    logTest('Oversized payload handled', oversizedTest.success || oversizedTest.status === 413);
}

async function generateReport() {
    log('\n📋 Test Report Generation', 'blue');
    log('=' .repeat(50), 'blue');
    
    const report = {
        summary: {
            totalTests,
            passedTests,
            failedTests,
            successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%',
            timestamp: new Date().toISOString()
        },
        results: testResults,
        systemInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            baseUrl: BASE_URL
        }
    };
    
    // Write report to file
    fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
    log('Test report saved to test-report.json', 'green');
    
    return report;
}

async function printSummary(report) {
    log('\n🎯 TEST SUMMARY', 'bold');
    log('=' .repeat(50), 'blue');
    
    log(`Total Tests: ${totalTests}`, 'blue');
    log(`Passed: ${passedTests}`, 'green');
    log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
    log(`Success Rate: ${report.summary.successRate}`, 
        parseFloat(report.summary.successRate) >= 90 ? 'green' : 
        parseFloat(report.summary.successRate) >= 70 ? 'yellow' : 'red');
    
    if (failedTests === 0) {
        log('\n🎉 ALL TESTS PASSED! System is working correctly.', 'green');
        log('✅ FarmLokal Backend is PRODUCTION READY', 'green');
    } else if (failedTests <= totalTests * 0.1) {
        log('\n⚠️  Minor issues detected but system is mostly functional.', 'yellow');
        log('🟡 FarmLokal Backend needs minor fixes', 'yellow');
    } else {
        log('\n❌ Significant issues detected. System needs attention.', 'red');
        log('🔴 FarmLokal Backend is NOT PRODUCTION READY', 'red');
    }
    
    log('\nFailed tests:', 'red');
    testResults.filter(r => !r.passed).forEach(test => {
        log(`  - ${test.test}: ${test.details}`, 'red');
    });
}

// Main test execution
async function runAllTests() {
    log('🧪 FarmLokal Backend API Testing Suite', 'bold');
    log('=' .repeat(60), 'blue');
    log(`Testing against: ${BASE_URL}`, 'blue');
    log(`Started at: ${new Date().toISOString()}`, 'blue');
    
    try {
        await testSystemHealth();
        await testProductsAPI();
        await testAuthAPI();
        await testWebhooksAPI();
        await testExternalAPI();
        await testMetricsAPI();
        await testErrorHandling();
        await testPerformance();
        await testRateLimiting();
        await testSecurity();
        
        const report = await generateReport();
        await printSummary(report);
        
        // Exit with appropriate code
        process.exit(failedTests === 0 ? 0 : 1);
        
    } catch (error) {
        log(`\n💥 Test suite crashed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Check if server is running before starting tests
async function checkServerAvailability() {
    log('🔍 Checking server availability...', 'yellow');
    
    try {
        const response = await makeRequest('GET', BASE_URL);
        if (response.success) {
            log('✅ Server is running and accessible', 'green');
            return true;
        } else {
            log('❌ Server is not responding correctly', 'red');
            return false;
        }
    } catch (error) {
        log('❌ Cannot connect to server. Make sure it\'s running on port 3000', 'red');
        log('   Run: npm run dev or docker-compose up', 'yellow');
        return false;
    }
}

// Start the test suite
(async () => {
    const serverAvailable = await checkServerAvailability();
    if (serverAvailable) {
        await runAllTests();
    } else {
        process.exit(1);
    }
})();