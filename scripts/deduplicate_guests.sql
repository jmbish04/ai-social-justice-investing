-- Script to deduplicate guest_profiles table
-- Keeps the oldest entry for each unique guest name (case-insensitive)
-- Run this via: npx wrangler d1 execute sji-app-db --remote --file scripts/deduplicate_guests.sql

-- First, create a temporary table with deduplicated guests
CREATE TEMP TABLE temp_unique_guests AS
SELECT 
  MIN(id) as id,
  name,
  persona_description,
  expertise,
  tone,
  background,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM guest_profiles
GROUP BY LOWER(TRIM(name));

-- Delete all existing guests
DELETE FROM guest_profiles;

-- Insert back only the unique ones
INSERT INTO guest_profiles (id, name, persona_description, expertise, tone, background, created_at, updated_at)
SELECT id, name, persona_description, expertise, tone, background, created_at, updated_at
FROM temp_unique_guests;

-- Clean up
DROP TABLE temp_unique_guests;

