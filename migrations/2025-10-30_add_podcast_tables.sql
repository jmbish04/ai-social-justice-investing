/**
 * 2025-10-30_add_podcast_tables.sql
 *
 * Establishes versioned transcript and audio metadata tables used by the
 * GeneratePodcastDemoWorkflow. The schema mirrors the structures referenced in
 * src/types/bindings.ts and extends existing migrations by including format,
 * word count, file metadata, and status tracking columns.
 */

-- Transcripts table
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

-- Audio versions table
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

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_episode_id ON transcripts(episode_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_version ON transcripts(episode_id, version);
CREATE INDEX IF NOT EXISTS idx_audio_versions_episode_id ON audio_versions(episode_id);
CREATE INDEX IF NOT EXISTS idx_audio_versions_status ON audio_versions(status);
CREATE INDEX IF NOT EXISTS idx_audio_versions_transcript_id ON audio_versions(transcript_id);
