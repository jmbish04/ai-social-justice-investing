/**
 * Migration 0004: Add research entries and pairings tables
 * Migrates data from JSON files to D1 for better scalability and consistency
 */

-- Research entries table: stores guest research profiles
CREATE TABLE IF NOT EXISTS research_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  chemistry TEXT,
  topic TEXT,
  link TEXT,
  date_added INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Pairings table: stores guest-author pairings with chemistry analysis
CREATE TABLE IF NOT EXISTS pairings (
  id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  author_name TEXT NOT NULL,
  chemistry_tags TEXT, -- JSON array stored as TEXT
  topic TEXT,
  reasoning TEXT,
  confidence_score INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_entries_name ON research_entries(name);
CREATE INDEX IF NOT EXISTS idx_research_entries_domain ON research_entries(domain);
CREATE INDEX IF NOT EXISTS idx_pairings_guest_name ON pairings(guest_name);
CREATE INDEX IF NOT EXISTS idx_pairings_author_name ON pairings(author_name);
CREATE INDEX IF NOT EXISTS idx_pairings_confidence_score ON pairings(confidence_score DESC);

-- Add status field to episodes table if it doesn't exist
-- This allows filtering episodes by status (planned, in-progress, completed, etc.)
-- Using a safe approach that won't fail if column already exists
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle this in application code
-- For now, episodes status can be inferred from related data or added via a separate migration if needed

