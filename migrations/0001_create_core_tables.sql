/**
 * Initial database schema migration for AI Social Justice Investing platform
 * Creates core tables for episodes, threads, messages, and ideas
 */

-- Episodes table: stores podcast episode metadata
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Threads table: stores brainstorm chat threads
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Messages table: stores chat messages within threads
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- Ideas table: stores submitted ideas from brainstorm sessions
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('episode', 'research', 'general')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_type ON ideas(type);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_thread_id ON ideas(thread_id);
CREATE INDEX IF NOT EXISTS idx_episodes_created_at ON episodes(created_at);
