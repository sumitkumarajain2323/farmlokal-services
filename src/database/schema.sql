-- FarmLokal Database Schema
-- This script creates the database schema for the FarmLokal backend

-- Create database (run this separately if needed)
-- CREATE DATABASE farmlokal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE farmlokal_db;

-- Farmers table
CREATE TABLE IF NOT EXISTS farmers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_farmers_email (email),
    INDEX idx_farmers_city (city),
    INDEX idx_farmers_verified (verified),
    INDEX idx_farmers_rating (rating)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    farmer_id INT NOT NULL,
    stock INT DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'kg',
    image_url VARCHAR(500),
    organic BOOLEAN DEFAULT FALSE,
    seasonal BOOLEAN DEFAULT FALSE,
    harvest_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_products_category (category),
    INDEX idx_products_farmer (farmer_id),
    INDEX idx_products_price (price),
    INDEX idx_products_stock (stock),
    INDEX idx_products_created_at (created_at),
    INDEX idx_products_name (name),
    INDEX idx_products_organic (organic),
    
    -- Composite indexes for common queries
    INDEX idx_products_category_price (category, price),
    INDEX idx_products_farmer_category (farmer_id, category),
    INDEX idx_products_created_at_id (created_at, id),
    INDEX idx_products_price_id (price, id),
    INDEX idx_products_name_id (name, id),
    
    -- Full-text search index
    FULLTEXT INDEX ft_products_search (name, description)
);

-- Webhook registrations table
CREATE TABLE IF NOT EXISTS webhook_registrations (
    id VARCHAR(36) PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    events JSON NOT NULL,
    secret VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_webhook_registrations_active (active),
    INDEX idx_webhook_registrations_created_at (created_at)
);

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    data JSON NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    signature VARCHAR(255),
    source VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_webhook_events_type (type),
    INDEX idx_webhook_events_source (source),
    INDEX idx_webhook_events_processed (processed),
    INDEX idx_webhook_events_created_at (created_at),
    INDEX idx_webhook_events_retry_count (retry_count),
    
    -- Composite indexes
    INDEX idx_webhook_events_type_processed (type, processed),
    INDEX idx_webhook_events_source_created_at (source, created_at)
);

-- Orders table (for webhook processing)
CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    farmer_id INT,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    delivery_address TEXT,
    delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE SET NULL,
    
    INDEX idx_orders_customer (customer_id),
    INDEX idx_orders_farmer (farmer_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_payment_status (payment_status),
    INDEX idx_orders_created_at (created_at),
    
    -- Composite indexes
    INDEX idx_orders_customer_status (customer_id, status),
    INDEX idx_orders_farmer_status (farmer_id, status)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id),
    
    -- Ensure unique product per order
    UNIQUE KEY uk_order_product (order_id, product_id)
);

-- Customers table (basic structure for webhook processing)
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_customers_email (email),
    INDEX idx_customers_city (city)
);

-- Product categories table (for better normalization)
CREATE TABLE IF NOT EXISTS product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    
    INDEX idx_categories_parent (parent_id),
    INDEX idx_categories_active (active)
);

-- Insert default categories
INSERT IGNORE INTO product_categories (name, description) VALUES
('Vegetables', 'Fresh vegetables and greens'),
('Fruits', 'Fresh seasonal fruits'),
('Grains', 'Rice, wheat, and other grains'),
('Pulses', 'Lentils, beans, and legumes'),
('Dairy', 'Milk, cheese, and dairy products'),
('Herbs', 'Fresh herbs and spices'),
('Organic', 'Certified organic products'),
('Seasonal', 'Seasonal specialty items');

-- Performance optimization: Create additional indexes based on common query patterns

-- Index for cursor-based pagination with different sort orders
ALTER TABLE products ADD INDEX idx_products_created_at_desc_id (created_at DESC, id DESC);
ALTER TABLE products ADD INDEX idx_products_price_desc_id (price DESC, id DESC);
ALTER TABLE products ADD INDEX idx_products_name_asc_id (name ASC, id ASC);

-- Index for filtered queries
ALTER TABLE products ADD INDEX idx_products_category_created_at (category, created_at DESC);
ALTER TABLE products ADD INDEX idx_products_price_range (price, created_at DESC);

-- Webhook events performance indexes
ALTER TABLE webhook_events ADD INDEX idx_webhook_events_created_at_desc (created_at DESC);
ALTER TABLE webhook_events ADD INDEX idx_webhook_events_type_created_at_desc (type, created_at DESC);

-- Views for common queries

-- Active products view
CREATE OR REPLACE VIEW active_products AS
SELECT 
    p.*,
    f.name as farmer_name,
    f.city as farmer_city,
    f.rating as farmer_rating
FROM products p
JOIN farmers f ON p.farmer_id = f.id
WHERE p.stock > 0 AND f.verified = TRUE;

-- Product summary view
CREATE OR REPLACE VIEW product_summary AS
SELECT 
    category,
    COUNT(*) as total_products,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    SUM(stock) as total_stock
FROM products
GROUP BY category;

-- Recent webhook events view
CREATE OR REPLACE VIEW recent_webhook_events AS
SELECT 
    id,
    type,
    source,
    processed,
    retry_count,
    created_at
FROM webhook_events
WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY created_at DESC;