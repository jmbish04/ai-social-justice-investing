/**
 * Migration 0006: Add unique constraint on guest_profiles.name
 * Prevents duplicate guest profiles with the same name
 */

-- First, remove any duplicate entries (keep the oldest one)
-- Note: This is a safe operation that won't break if there are no duplicates
DELETE FROM guest_profiles 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM guest_profiles 
  GROUP BY LOWER(TRIM(name))
);

-- Add unique constraint on name (case-insensitive via index)
-- SQLite doesn't support UNIQUE constraints on computed columns directly,
-- so we'll use a unique index and enforce uniqueness in application code
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_profiles_name_unique 
ON guest_profiles(LOWER(TRIM(name)));

-- Also add an index on name for faster lookups (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_guest_profiles_name ON guest_profiles(name);

