-- =========================================================
-- FINANCE AI — DATABASE SCHEMA (MySQL 5.7+ / 8.0+)
-- =========================================================

-- 1. Create Database if not exists
CREATE DATABASE IF NOT EXISTS finance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE finance_db;

-- 2. Create Transactions Table
-- Directly maps to the JSON structure of Transaction objects
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT PRIMARY KEY,
  merchant VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  date VARCHAR(100) NOT NULL,
  image LONGTEXT NULL,
  items JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Initial Sample Data (Corresponds to DEFAULT_TRANSACTIONS)
INSERT INTO transactions (id, merchant, category, total, date, image, items)
VALUES
(
  1714500001,
  '7-Eleven',
  'Shopping',
  224.00,
  'Today · 00:39',
  'assets/demo_7eleven.jpg',
  JSON_ARRAY(
    JSON_OBJECT('name', 'Tissue Paper 3-Ply Soft', 'price', 115),
    JSON_OBJECT('name', 'Snack & Drink Combo', 'price', 109)
  )
),
(
  1714500002,
  'Goodmate',
  'Food',
  95.00,
  'Today · 00:38',
  'assets/demo_goodmate.jpg',
  JSON_ARRAY(
    JSON_OBJECT('name', 'Goodmate Oat Milk Original 1L', 'price', 95)
  )
)
ON DUPLICATE KEY UPDATE id = id;
