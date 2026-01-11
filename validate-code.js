#!/usr/bin/env node

/**
 * Code Structure Validation for FarmLokal Backend
 * Validates the codebase structure and identifies potential issues
 */

const fs = require('fs');
const path = require('path');

// Colors for output
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

// Validation results
let validationResults = {
    structure: [],
    files: [],
    dependencies: [],
    configuration: []
};

function validateFileExists(filePath, description) {
    const exists = fs.existsSync(filePath);
    const result = {
        test: `${description} exists`,
        path: filePath,
        passed: exists
    };
    
    validationResults.files.push(result);
    
    if (exists) {
        log(`✅ ${description}: ${filePath}`, 'green');
    } else {
        log(`❌ Missing ${description}: ${filePath}`, 'red');
    }
    
    return exists;
}

function validateDirectoryStructure() {
    log('\n📁 Validating Directory Structure', 'blue');
    log('='.repeat(50));
    
    const requiredDirs = [
        'src',
        'src/config',
        'src/modules',
        'src/modules/auth',
        'src/modules/products',
        'src/modules/webhooks',
        'src/modules/externalApis',
        'src/database',
        'src/cache',
        'src/middlewares',
        'src/routes',
        'src/utils'
    ];
    
    requiredDirs.forEach(dir => {
        validateFileExists(dir, `Directory ${dir}`);
    });
}

function validateCoreFiles() {
    log('\n📄 Validating Core Files', 'blue');
    log('='.repeat(50));
    
    const coreFiles = [
        'package.json',
        'tsconfig.json',
        '.env.example',
        'src/index.ts',
        'src/config/index.ts',
        'src/config/database.ts',
        'src/config/redis.ts',
        'src/utils/logger.ts',
        'src/utils/errors.ts',
        'src/utils/response.ts',
        'src/database/schema.sql',
        'src/database/migrate.ts',
        'src/database/seed.ts'
    ];
    
    coreFiles.forEach(file => {
        validateFileExists(file, `Core file ${file}`);
    });
}

function validateModules() {
    log('\n🧩 Validating Modules', 'blue');
    log('='.repeat(50));
    
    const moduleFiles = [
        'src/modules/auth/oauth-service.ts',
        'src/modules/products/product-service.ts',
        'src/modules/webhooks/webhook-service.ts',
        'src/modules/externalApis/api-a-service.ts',
        'src/cache/redis-client.ts',
        'src/cache/cache-keys.ts'
    ];
    
    moduleFiles.forEach(file => {
        validateFileExists(file, `Module ${file}`);
    });
}

function validateRoutes() {
    log('\n🛣️  Validating Routes', 'blue');
    log('='.repeat(50));
    
    const routeFiles = [
        'src/routes/index.ts',
        'src/routes/products.ts',
        'src/routes/auth.ts',
        'src/routes/webhooks.ts',
        'src/routes/external-api.ts',
        'src/routes/metrics.ts'
    ];
    
    routeFiles.forEach(file => {
        validateFileExists(file, `Route ${file}`);
    });
}

function validateMiddlewares() {
    log('\n🛡️  Validating Middlewares', 'blue');
    log('='.repeat(50));
    
    const middlewareFiles = [
        'src/middlewares/error-handler.ts',
        'src/middlewares/rate-limiter.ts',
        'src/middlewares/security.ts',
        'src/middlewares/request-deduplication.ts'
    ];
    
    middlewareFiles.forEach(file => {
        validateFileExists(file, `Middleware ${file}`);
    });
}

function validatePackageJson() {
    log('\n📦 Validating Package Configuration', 'blue');
    log('='.repeat(50));
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        // Check required dependencies
        const requiredDeps = [
            'express', 'mysql2', 'redis', 'axios', 'helmet', 
            'cors', 'compression', 'winston', 'dotenv'
        ];
        
        const requiredDevDeps = [
            'typescript', 'ts-node', '@types/express', '@types/node'
        ];
        
        requiredDeps.forEach(dep => {
            if (packageJson.dependencies && packageJson.dependencies[dep]) {
                log(`✅ Dependency: ${dep}`, 'green');
                validationResults.dependencies.push({ dep, type: 'production', exists: true });
            } else {
                log(`❌ Missing dependency: ${dep}`, 'red');
                validationResults.dependencies.push({ dep, type: 'production', exists: false });
            }
        });
        
        requiredDevDeps.forEach(dep => {
            if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
                log(`✅ Dev dependency: ${dep}`, 'green');
                validationResults.dependencies.push({ dep, type: 'development', exists: true });
            } else {
                log(`❌ Missing dev dependency: ${dep}`, 'red');
                validationResults.dependencies.push({ dep, type: 'development', exists: false });
            }
        });
        
        // Check scripts
        const requiredScripts = ['build', 'start', 'dev', 'migrate', 'seed'];
        requiredScripts.forEach(script => {
            if (packageJson.scripts && packageJson.scripts[script]) {
                log(`✅ Script: ${script}`, 'green');
            } else {
                log(`❌ Missing script: ${script}`, 'red');
            }
        });
        
    } catch (error) {
        log(`❌ Error reading package.json: ${error.message}`, 'red');
    }
}

function validateTsConfig() {
    log('\n⚙️  Validating TypeScript Configuration', 'blue');
    log('='.repeat(50));
    
    try {
        const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
        
        const requiredOptions = [
            'target', 'module', 'outDir', 'rootDir', 'strict', 'esModuleInterop'
        ];
        
        requiredOptions.forEach(option => {
            if (tsConfig.compilerOptions && tsConfig.compilerOptions[option] !== undefined) {
                log(`✅ TypeScript option: ${option}`, 'green');
            } else {
                log(`❌ Missing TypeScript option: ${option}`, 'red');
            }
        });
        
        // Check path mapping
        if (tsConfig.compilerOptions && tsConfig.compilerOptions.paths) {
            log(`✅ Path mapping configured`, 'green');
        } else {
            log(`⚠️  Path mapping not configured`, 'yellow');
        }
        
    } catch (error) {
        log(`❌ Error reading tsconfig.json: ${error.message}`, 'red');
    }
}

function validateDockerFiles() {
    log('\n🐳 Validating Docker Configuration', 'blue');
    log('='.repeat(50));
    
    const dockerFiles = [
        'Dockerfile',
        'docker-compose.yml',
        '.dockerignore'
    ];
    
    dockerFiles.forEach(file => {
        validateFileExists(file, `Docker file ${file}`);
    });
}

function checkFileContent(filePath, requiredContent, description) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const hasContent = requiredContent.every(item => content.includes(item));
            
            if (hasContent) {
                log(`✅ ${description} has required content`, 'green');
            } else {
                log(`⚠️  ${description} missing some required content`, 'yellow');
            }
            
            return hasContent;
        }
    } catch (error) {
        log(`❌ Error checking ${description}: ${error.message}`, 'red');
    }
    return false;
}

function validateKeyFileContents() {
    log('\n🔍 Validating Key File Contents', 'blue');
    log('='.repeat(50));
    
    // Check main index.ts
    checkFileContent('src/index.ts', [
        'express', 'database', 'redis', 'logger', 'routes'
    ], 'Main index.ts');
    
    // Check database config
    checkFileContent('src/config/database.ts', [
        'mysql2', 'createPool', 'getPool'
    ], 'Database configuration');
    
    // Check Redis config
    checkFileContent('src/config/redis.ts', [
        'redis', 'createClient', 'getClient'
    ], 'Redis configuration');
    
    // Check OAuth service
    checkFileContent('src/modules/auth/oauth-service.ts', [
        'axios', 'redisCache', 'getAccessToken', 'refreshToken'
    ], 'OAuth service');
    
    // Check product service
    checkFileContent('src/modules/products/product-service.ts', [
        'database', 'redisCache', 'getProducts', 'cursor'
    ], 'Product service');
}

function generateReport() {
    log('\n📊 Validation Summary', 'bold');
    log('='.repeat(50));
    
    const totalFiles = validationResults.files.length;
    const passedFiles = validationResults.files.filter(f => f.passed).length;
    const failedFiles = totalFiles - passedFiles;
    
    const totalDeps = validationResults.dependencies.length;
    const passedDeps = validationResults.dependencies.filter(d => d.exists).length;
    const failedDeps = totalDeps - passedDeps;
    
    log(`Files: ${passedFiles}/${totalFiles} passed`, passedFiles === totalFiles ? 'green' : 'yellow');
    log(`Dependencies: ${passedDeps}/${totalDeps} found`, passedDeps === totalDeps ? 'green' : 'yellow');
    
    const overallScore = ((passedFiles + passedDeps) / (totalFiles + totalDeps) * 100).toFixed(1);
    log(`Overall Score: ${overallScore}%`, overallScore >= 90 ? 'green' : overallScore >= 70 ? 'yellow' : 'red');
    
    if (failedFiles === 0 && failedDeps === 0) {
        log('\n🎉 Code structure validation PASSED!', 'green');
        log('✅ All required files and dependencies are present', 'green');
        return true;
    } else {
        log('\n⚠️  Code structure validation has issues', 'yellow');
        if (failedFiles > 0) {
            log(`❌ ${failedFiles} missing files`, 'red');
        }
        if (failedDeps > 0) {
            log(`❌ ${failedDeps} missing dependencies`, 'red');
        }
        return false;
    }
}

// Main validation function
async function runValidation() {
    log('🔍 FarmLokal Backend Code Validation', 'bold');
    log('='.repeat(60));
    log(`Validation started: ${new Date().toISOString()}`);
    
    validateDirectoryStructure();
    validateCoreFiles();
    validateModules();
    validateRoutes();
    validateMiddlewares();
    validatePackageJson();
    validateTsConfig();
    validateDockerFiles();
    validateKeyFileContents();
    
    const isValid = generateReport();
    
    // Save validation report
    const report = {
        timestamp: new Date().toISOString(),
        results: validationResults,
        summary: {
            totalFiles: validationResults.files.length,
            passedFiles: validationResults.files.filter(f => f.passed).length,
            totalDependencies: validationResults.dependencies.length,
            foundDependencies: validationResults.dependencies.filter(d => d.exists).length,
            isValid
        }
    };
    
    fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
    log('\n📄 Validation report saved to: validation-report.json', 'blue');
    
    return isValid;
}

// Run validation
runValidation().then(isValid => {
    process.exit(isValid ? 0 : 1);
}).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
});