/**
 * Guest profiles and episode-guest relationship tables
 * Supports multi-guest podcast episodes with dynamic persona loading
 */

-- Guest profiles table: stores AI agent persona data for potential podcast guests
CREATE TABLE IF NOT EXISTS guest_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  persona_description TEXT NOT NULL,
  expertise TEXT,
  tone TEXT,
  background TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Episode-guest junction table: many-to-many relationship between episodes and guests
CREATE TABLE IF NOT EXISTS episode_guests (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  guest_profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_profile_id) REFERENCES guest_profiles(id) ON DELETE CASCADE,
  UNIQUE(episode_id, guest_profile_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_episode_guests_episode_id ON episode_guests(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_guests_guest_id ON episode_guests(guest_profile_id);
CREATE INDEX IF NOT EXISTS idx_guest_profiles_name ON guest_profiles(name);
