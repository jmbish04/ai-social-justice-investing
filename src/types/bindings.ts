// Cloudflare Worker bindings
export type Bindings = {
  IDEAS_KV: KVNamespace;
  RESEARCH_KV: KVNamespace;
  ADMIN_TOKEN: string;
  ENVIRONMENT: string;
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
