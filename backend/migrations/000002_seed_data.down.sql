-- Rollback seed data
DELETE FROM users WHERE username = 'admin';
DELETE FROM business_settings;
DELETE FROM expense_categories;
DELETE FROM categories;
DELETE FROM role_permissions;
DELETE FROM permissions;
DELETE FROM roles;
