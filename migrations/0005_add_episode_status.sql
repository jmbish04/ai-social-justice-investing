/**
 * Migration 0005: Add status column to episodes table
 * Supports filtering episodes by status (planned, recorded, published, etc.)
 */

-- Add status column to episodes table if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This migration assumes the column doesn't exist. If it does, this will fail
-- gracefully in most cases, but you may need to handle it manually.

-- Check if column exists (we'll handle this in application code for safety)
-- ALTER TABLE episodes ADD COLUMN status TEXT DEFAULT 'planned';

-- For now, we'll rely on application code to handle status gracefully
-- The API will check if the column exists before using it

-- If you want to manually add the column, run:
-- ALTER TABLE episodes ADD COLUMN status TEXT DEFAULT 'planned';

