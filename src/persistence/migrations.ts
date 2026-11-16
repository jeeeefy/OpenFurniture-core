/**
 * Migrations live in the pure domain (T-102) so that decodeDesign and the server can reuse them.
 * This module keeps the historical import path stable for src/persistence and its tests.
 */
export * from '@/domain/document/migrations';
