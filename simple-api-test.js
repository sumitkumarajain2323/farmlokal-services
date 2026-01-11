#!/usr/bin/env node

/**
 * Simple API Test Runner for FarmLokal Backend
 * Tests core functionality without external dependencies
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// Test tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Simple HTTP client
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FarmLokal-Test-Client',
                ...options.headers
            },
            timeout: 10000
        };
        
        const req = client.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : null;
                    resolve({
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        data: jsonData,
                        headers: res.headers,
                        rawData: data
                    });
                } catch (error) {
                    resolve({
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        data: null,
                        headers: res.headers,
                        rawData: data,
                        parseError: error.message
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject({
                success: false,
                error: error.message,
                code: error.code
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject({
                success: false,
                error: 'Request timeout',
                code: 'TIMEOUT'
            });
        });
        
        if (options.data) {
            req.write(JSON.stringify(options.data));
        }
        
        req.end();
    });
}

// Test utilities
function logTest(testName, passed, details = '') {
    totalTests++;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${color}${status}\x1b[0m: ${testName}`);
    
    if (!passed && details) {
        console.log(`   \x1b[33mDetails: ${details}\x1b[0m`);
    }
    
    if (passed) {
        passedTests++;
    } else {
        failedTests++;
    }
}

function log(message, color = '') {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        bold: '\x1b[1m',
        reset: '\x1b[0m'
    };
    
    const colorCode = colors[color] || '';
    console.log(`${colorCode}${message}${colors.reset}`);
}

// Test functions
async function testSystemHealth() {
    log('\n🏥 Testing System Health', 'blue');
    log('='.repeat(50));
    
    try {
        // Test root endpoint
        const rootResponse = await makeRequest(BASE_URL);
        logTest('Root endpoint accessible', rootResponse.success);
        
        // Test health endpoint
        const healthResponse = await makeRequest(`${BASE_URL}/health`);
        logTest('Health endpoint responding', healthResponse.success);
        
        if (healthResponse.success && healthResponse.data) {
            const isHealthy = healthResponse.data.status === 'healthy';
            logTest('System reports healthy status', isHealthy, 
                   `Status: ${healthResponse.data.status}`);
        }
        
        // Test API root
        const apiResponse = await makeRequest(API_BASE);
        logTest('API root endpoint accessible', apiResponse.success);
        
    } catch (error) {
        logTest('System health check', false, error.message);
    }
}

async function testProductsAPI() {
    log('\n🛒 Testing Products API', 'blue');
    log('='.repeat(50));
    
    try {
        // Test basic product listing
        const productsResponse = await makeRequest(`${API_BASE}/products`);
        logTest('GET /products endpoint', productsResponse.success);
        
        if (productsResponse.success && productsResponse.data) {
            const hasData = productsResponse.data.data && Array.isArray(productsResponse.data.data);
            logTest('Products endpoint returns array data', hasData);
            
            const hasPagination = productsResponse.data.meta && productsResponse.data.meta.pagination;
            logTest('Products endpoint includes pagination', !!hasPagination);
        }
        
        // Test with parameters
        const paramsResponse = await makeRequest(`${API_BASE}/products?limit=5&sortBy=price`);
        logTest('GET /products with parameters', paramsResponse.success);
        
        // Test search
        const searchResponse = await makeRequest(`${API_BASE}/products/search?q=test`);
        logTest('GET /products/search', searchResponse.success);
        
        // Test count
        const countResponse = await makeRequest(`${API_BASE}/products/count`);
        logTest('GET /products/count', countResponse.success);
        
        // Test invalid product ID (should return 404)
        const invalidResponse = await makeRequest(`${API_BASE}/products/999999999`);
        logTest('Invalid product ID returns 404', invalidResponse.status === 404);
        
    } catch (error) {
        logTest('Products API test', false, error.message);
    }
}

async function testAuthAPI() {
    log('\n🔐 Testing Authentication API', 'blue');
    log('='.repeat(50));
    
    try {
        // Test token info
        const tokenResponse = await makeRequest(`${API_BASE}/auth/token`);
        logTest('GET /auth/token', tokenResponse.success || tokenResponse.status === 401);
        
        // Test token refresh
        const refreshResponse = await makeRequest(`${API_BASE}/auth/token/refresh`, { method: 'POST' });
        logTest('POST /auth/token/refresh', refreshResponse.success || refreshResponse.status === 401);
        
        // Test token deletion
        const deleteResponse = await makeRequest(`${API_BASE}/auth/token`, { method: 'DELETE' });
        logTest('DELETE /auth/token', deleteResponse.success || deleteResponse.status === 401);
        
    } catch (error) {
        logTest('Auth API test', false, error.message);
    }
}

async function testWebhooksAPI() {
    log('\n🪝 Testing Webhooks API', 'blue');
    log('='.repeat(50));
    
    try {
        // Test webhook registration
        const registerData = {
            url: 'https://example.com/webhook',
            events: ['order.created', 'product.updated']
        };
        const registerResponse = await makeRequest(`${API_BASE}/webhooks/register`, {
            method: 'POST',
            data: registerData
        });
        logTest('POST /webhooks/register', registerResponse.success);
        
        // Test webhook event
        const eventData = {
            type: 'test.event',
            data: { testId: Date.now(), message: 'Test event' },
            timestamp: new Date().toISOString()
        };
        const eventResponse = await makeRequest(`${API_BASE}/webhooks/events`, {
            method: 'POST',
            data: eventData
        });
        logTest('POST /webhooks/events', eventResponse.success);
        
        // Test webhook events listing
        const listResponse = await makeRequest(`${API_BASE}/webhooks/events`);
        logTest('GET /webhooks/events', listResponse.success);
        
    } catch (error) {
        logTest('Webhooks API test', false, error.message);
    }
}

async function testMetricsAPI() {
    log('\n📊 Testing Metrics API', 'blue');
    log('='.repeat(50));
    
    try {
        // Test system metrics
        const metricsResponse = await makeRequest(`${API_BASE}/metrics`);
        logTest('GET /metrics', metricsResponse.success);
        
        // Test health metrics
        const healthResponse = await makeRequest(`${API_BASE}/metrics/health`);
        logTest('GET /metrics/health', healthResponse.success);
        
        // Test product metrics
        const productMetricsResponse = await makeRequest(`${API_BASE}/metrics/products`);
        logTest('GET /metrics/products', productMetricsResponse.success);
        
    } catch (error) {
        logTest('Metrics API test', false, error.message);
    }
}

async function testErrorHandling() {
    log('\n🚨 Testing Error Handling', 'blue');
    log('='.repeat(50));
    
    try {
        // Test 404
        const notFoundResponse = await makeRequest(`${API_BASE}/non-existent-endpoint`);
        logTest('404 for non-existent endpoint', notFoundResponse.status === 404);
        
        // Test invalid JSON
        const invalidJsonResponse = await makeRequest(`${API_BASE}/webhooks/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: 'invalid json'
        });
        logTest('Invalid JSON handled', invalidJsonResponse.status === 400);
        
        // Test missing fields
        const missingFieldsResponse = await makeRequest(`${API_BASE}/webhooks/events`, {
            method: 'POST',
            data: {}
        });
        logTest('Missing fields validation', missingFieldsResponse.status === 400);
        
    } catch (error) {
        logTest('Error handling test', false, error.message);
    }
}

async function testPerformance() {
    log('\n⚡ Testing Performance', 'blue');
    log('='.repeat(50));
    
    try {
        // Test response time
        const startTime = Date.now();
        const perfResponse = await makeRequest(`${API_BASE}/products?limit=10`);
        const responseTime = Date.now() - startTime;
        
        logTest('Response time < 1000ms', responseTime < 1000, `${responseTime}ms`);
        logTest('Response time < 500ms', responseTime < 500, `${responseTime}ms`);
        
        // Test multiple concurrent requests
        log('Testing concurrent requests...', 'yellow');
        const concurrentPromises = [];
        for (let i = 0; i < 5; i++) {
            concurrentPromises.push(makeRequest(`${API_BASE}/products?limit=5`));
        }
        
        const concurrentStart = Date.now();
        const concurrentResults = await Promise.all(concurrentPromises.map(p => 
            p.catch(error => ({ success: false, error: error.message }))
        ));
        const concurrentTime = Date.now() - concurrentStart;
        
        const successfulConcurrent = concurrentResults.filter(r => r.success).length;
        logTest('Concurrent requests handled', successfulConcurrent >= 3, 
               `${successfulConcurrent}/5 successful in ${concurrentTime}ms`);
        
    } catch (error) {
        logTest('Performance test', false, error.message);
    }
}

// Main test runner
async function runAllTests() {
    log('🧪 FarmLokal Backend API Test Suite', 'bold');
    log('='.repeat(60));
    log(`Testing: ${BASE_URL}`);
    log(`Started: ${new Date().toISOString()}`);
    
    // Check if server is accessible
    try {
        const serverCheck = await makeRequest(BASE_URL);
        if (!serverCheck.success) {
            log('❌ Server is not accessible. Make sure it\'s running on port 3000', 'red');
            log('   Run: npm run dev or docker-compose up', 'yellow');
            process.exit(1);
        }
        log('✅ Server is accessible', 'green');
    } catch (error) {
        log('❌ Cannot connect to server:', 'red');
        log(`   ${error.message}`, 'red');
        log('   Make sure the server is running on port 3000', 'yellow');
        process.exit(1);
    }
    
    // Run all test suites
    await testSystemHealth();
    await testProductsAPI();
    await testAuthAPI();
    await testWebhooksAPI();
    await testMetricsAPI();
    await testErrorHandling();
    await testPerformance();
    
    // Print summary
    log('\n🎯 TEST SUMMARY', 'bold');
    log('='.repeat(50));
    log(`Total Tests: ${totalTests}`, 'blue');
    log(`Passed: ${passedTests}`, 'green');
    log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
    
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    log(`Success Rate: ${successRate}%`, 
        successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');
    
    if (failedTests === 0) {
        log('\n🎉 ALL TESTS PASSED!', 'green');
        log('✅ FarmLokal Backend is working correctly', 'green');
    } else if (failedTests <= totalTests * 0.1) {
        log('\n⚠️  Minor issues detected', 'yellow');
        log('🟡 System is mostly functional', 'yellow');
    } else {
        log('\n❌ Significant issues detected', 'red');
        log('🔴 System needs attention', 'red');
    }
    
    process.exit(failedTests === 0 ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
    console.error('Test suite crashed:', error);
    process.exit(1);
});