/**
 * Cloudflare Worker bindings
 * Defines all environment bindings available to the Worker
 */
export type Bindings = {
  // D1 Database for structured data
  DB: D1Database;

  // R2 Bucket for audio files and transcripts
  BUCKET: R2Bucket;

  // KV Namespace for session and ephemeral chat memory
  KV: KVNamespace;

  // Legacy KV Namespaces (preserved for backward compatibility)
  IDEAS_KV: KVNamespace;
  RESEARCH_KV: KVNamespace;

  // Durable Objects
  CHAT_COORDINATOR: DurableObjectNamespace;
  EPISODE_ACTOR: DurableObjectNamespace;

  // AI Model bindings
  AI: Ai;

  // Environment variables
  ADMIN_TOKEN: string;
  ENVIRONMENT: string;
  R2_PUBLIC_URL: string;
  MODEL_REASONING: string;
  MODEL_STT: string;
};

// Research entry
export interface ResearchEntry {
  id: string;
  name: string;
  domain: string;
  chemistry: string;
  topic: string;
  link: string;
  dateAdded?: string;
}

// Podcast episode
export interface Episode {
  id: string;
  title: string;
  description: string;
  guest: string;
  status: 'planned' | 'recorded' | 'published';
  dateCreated?: string;
}

// Guest-Author pairing
export interface Pairing {
  id: string;
  guestName: string;
  authorName: string;
  chemistry: string[];
  topic: string;
  reasoning: string;
  confidenceScore?: number;
}

// Submitted idea
export interface SubmittedIdea {
  id: string;
  content: string;
  type: 'episode' | 'research' | 'general';
  timestamp: string;
  status: 'pending' | 'reviewed' | 'approved';
}

/**
 * New database types for AI-powered features
 */

// Thread: represents a brainstorm chat session
export interface Thread {
  id: string;
  user_id: string | null;
  title: string | null;
  created_at: number;
  updated_at: number | null;
}

// Message: represents a chat message within a thread
export interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

// Idea: represents a saved idea from brainstorm sessions (stored in D1)
export interface Idea {
  id: string;
  thread_id: string | null;
  content: string;
  type: 'episode' | 'research' | 'general';
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  created_at: number;
  updated_at: number | null;
}

// GuestProfile: represents an AI agent persona for podcast guests
export interface GuestProfile {
  id: string;
  name: string;
  persona_description: string;
  expertise: string | null;
  tone: string | null;
  background: string | null;
  created_at: number;
  updated_at: number | null;
}

// EpisodeGuest: junction table linking episodes to guest profiles
export interface EpisodeGuest {
  id: string;
  episode_id: string;
  guest_profile_id: string;
  created_at: number;
}

// Transcript: represents a podcast transcript with versioning
export interface Transcript {
  id: string;
  episode_id: string;
  version: number;
  body: string;
  format: string;
  word_count: number | null;
  created_at: number;
}

// AudioVersion: represents audio file metadata in R2
export interface AudioVersion {
  id: string;
  episode_id: string;
  transcript_id: string;
  version: number;
  r2_key: string;
  r2_url: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  status: 'generating' | 'ready' | 'failed';
  created_at: number;
}

/**
 * Extended Episode interface with guest relationships
 */
export interface EpisodeWithGuests extends Episode {
  guests?: GuestProfile[];
  transcript?: Transcript;
  audio?: AudioVersion;
}
