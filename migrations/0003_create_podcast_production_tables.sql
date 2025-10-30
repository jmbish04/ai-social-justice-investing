/**
 * Podcast production tables for transcripts and audio versions
 * Supports versioning and R2 storage integration
 */

-- Transcripts table: stores generated podcast transcripts with versioning
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  format TEXT DEFAULT 'markdown',
  word_count INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  UNIQUE(episode_id, version)
);

-- Audio versions table: stores metadata for generated audio files in R2
CREATE TABLE IF NOT EXISTS audio_versions (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  transcript_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE,
  UNIQUE(episode_id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcripts_episode_id ON transcripts(episode_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_version ON transcripts(episode_id, version);
CREATE INDEX IF NOT EXISTS idx_audio_versions_episode_id ON audio_versions(episode_id);
CREATE INDEX IF NOT EXISTS idx_audio_versions_status ON audio_versions(status);
CREATE INDEX IF NOT EXISTS idx_audio_versions_transcript_id ON audio_versions(transcript_id);
