// Set test database URL before any modules are loaded.
// This file runs via jest.config.js setupFiles before each test suite.
// Tests use their own SQLite file so they never contend with a running dev server
// (which holds api/database/workshophub.sqlite). CI may override DATABASE_URL.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:../database/workshophub-test.sqlite'
process.env.NODE_ENV = 'test'
