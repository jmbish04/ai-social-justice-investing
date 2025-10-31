# AI Social Justice Investing - Implementation Guide

This document provides a comprehensive overview of the AI-powered podcast generation platform implementation.

## 📋 Overview

This platform enables AI-driven podcast creation with multi-guest conversations, brainstorming tools, and automated transcript/audio generation. Built entirely on Cloudflare's stack (Workers, D1, R2, Durable Objects, Workers AI).

## 🏗️ Architecture

### Backend (Cloudflare Workers + Hono)

```
src/
├── index.ts                    # Main Worker entry point, exports Durable Objects
├── api/
│   ├── routes.ts              # Legacy API routes (research, episodes list, pairings)
│   └── newRoutes.ts           # New API routes (threads, messages, podcast generation)
├── agents/
│   ├── HostAgent.ts           # Andrea Longton's AI podcast host persona
│   ├── GuestAgent.ts          # Dynamic guest agent (loads persona from DB)
│   ├── PodcastBuilderAgent.ts # Orchestrates multi-guest transcript generation
│   └── AudioDirectorAgent.ts   # Audio synthesis and R2 upload (stub implementation)
├── actors/
│   └── EpisodeActor.ts        # Durable Object for episode workflow serialization
├── do/
│   └── ChatCoordinatorDO.ts   # Durable Object for brainstorm chat state
├── workflows/
│   └── generatePodcastDemo.ts # Main podcast generation pipeline
├── schemas/
│   └── index.ts               # Zod validation schemas for API
├── types/
│   └── bindings.ts            # TypeScript interfaces for all data models
└── middleware/
    └── auth.ts                # Token-based authentication middleware
```

### Frontend (React + Vite)

```
frontend/src/
├── main.tsx                   # React app entry point with routing
├── index.css                  # Tailwind CSS configuration
├── contexts/
│   └── AudioPlayerContext.tsx # Global audio player state (iOS-compatible)
└── pages/
    ├── HomePage.tsx           # Landing page
    ├── BrainstormPage.tsx     # AI chat interface for ideation
    ├── EpisodesListPage.tsx   # Episode browser
    └── EpisodePage.tsx        # Episode details + podcast generation
```

### Database (D1)

Three migration files in `migrations/`:

1. **0001_create_core_tables.sql** - Core tables: episodes, threads, messages, ideas
2. **0002_create_guest_tables.sql** - Guest profiles and episode-guest relationships
3. **0003_create_podcast_production_tables.sql** - Transcripts and audio versions

## 🔑 Key Features Implemented

### 1. Brainstorm Chat System

**Components:**
- `ChatCoordinatorDO` (Durable Object) - Maintains session state per thread
- `BrainstormPage` (React) - Chat UI with message history
- `/api/threads` - Create/retrieve threads
- `/api/threads/:id/messages` - Message history
- `/api/brainstorm/:threadId/reply` - AI-powered responses using Workers AI

**Flow:**
1. User creates new thread → D1 + DO initialization
2. User sends message → Saved to D1, added to DO context
3. Workers AI generates response using conversation history
4. Response saved to D1 and DO, streamed to frontend

### 2. Multi-Guest Podcast Generation

**Components:**
- `PodcastBuilderAgent` - Orchestrates host + multiple guests
- `HostAgent` - Embodies Andrea Longton's persona
- `GuestAgent` - Dynamically created from guest_profiles table
- `EpisodeActor` - Serializes workflows to prevent race conditions
- `generatePodcastDemoWorkflow` - End-to-end generation pipeline

**Flow:**
1. User triggers generation on EpisodePage
2. Workflow fetches episode and guest profiles from D1
3. Instantiates HostAgent + N × GuestAgent(s)
4. PodcastBuilderAgent generates structured outline
5. Agents converse turn-by-turn to create transcript
6. Transcript saved to D1 with version number
7. AudioDirectorAgent generates audio (currently stub)
8. Audio uploaded to R2, metadata saved to D1
9. EpisodeActor tracks progress and status

### 3. Guest Management

**Components:**
- `guest_profiles` table - Stores AI persona descriptions
- `episode_guests` junction table - Many-to-many episode ↔ guest
- `/api/guest-profiles` - CRUD operations
- `/api/episodes/:id/guests` - Assign/list guests per episode

**Guest Profile Structure:**
```typescript
{
  id: string
  name: string
  persona_description: string  // Core AI personality definition
  expertise: string            // Domain knowledge areas
  tone: string                 // Speaking style (warm, analytical, etc.)
  background: string           // Context for responses
}
```

### 4. Global Audio Player

**Components:**
- `AudioPlayerContext` - React Context with persistent HTML5 Audio
- Sticky player UI at bottom of screen
- iOS-compatible playback controls

**Features:**
- Seamless playback across page navigation
- Progress tracking and seek controls
- Volume adjustment
- Episode metadata display

## 🔧 Configuration

### Environment Bindings (wrangler.toml)

```toml
# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "sji-app-db"
database_id = "34b476f8-1f88-4062-816d-2acfb3449a7d"

# R2 Bucket
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "sji-app-public"

# KV Namespace
[[kv_namespaces]]
binding = "KV"
id = "ae22b132a2fd453ca9cc04c1ab3b0da9"

# Durable Objects
[[durable_objects.bindings]]
name = "CHAT_COORDINATOR"
class_name = "ChatCoordinatorDO"

[[durable_objects.bindings]]
name = "EPISODE_ACTOR"
class_name = "EpisodeActor"

# Variables
[vars]
R2_PUBLIC_URL = "https://sji-app-public.b3304b14848de15c72c24a14b0cd187d.r2.dev"
MODEL_REASONING = "@cf/meta/llama-3.1-8b-instruct"
MODEL_STT = "@cf/openai/whisper-base-en"
```

### Static Assets

Frontend builds to `/dist` and is served via ASSETS binding:

```toml
[assets]
directory = "./dist"
binding = "ASSETS"
```

## 🚀 Deployment

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Apply Database Migrations

```bash
npm run db:migrate
# Or for local development:
npm run db:migrate:local
```

### Step 3: Build Frontend

```bash
npm run build:frontend
```

### Step 4: Deploy Worker

```bash
npm run deploy
```

### Development Mode

```bash
# Terminal 1: Vite dev server (React hot reload)
npx vite

# Terminal 2: Wrangler dev (Worker + D1 + R2 + DO)
npm run dev
```

## 📡 API Endpoints

### Brainstorm & Threads

- `POST /api/threads` - Create new thread
- `GET /api/threads/:id` - Get thread details
- `GET /api/threads/:id/messages` - Get message history
- `POST /api/brainstorm/:threadId/reply` - Send message, get AI response

### Ideas

- `POST /api/ideas` - Save idea from brainstorm
- `GET /api/ideas` - List all ideas (requires auth)

### Episodes

- `GET /api/episodes` - List episodes
- `POST /api/episodes` - Create episode (requires auth)
- `GET /api/episodes/:id` - Get episode details
- `GET /api/episodes/:id/guests` - List episode guests
- `POST /api/episodes/:id/guests` - Add guest to episode (requires auth)
- `POST /api/episodes/:id/generate-audio` - Trigger podcast generation (requires auth)

### Guest Profiles

- `GET /api/guest-profiles` - List all guest profiles
- `POST /api/guest-profiles` - Create guest profile (requires auth)
- `GET /api/guest-profiles/:id` - Get guest profile

### Legacy Endpoints (Preserved)

- `GET /api/research` - Research entries
- `GET /api/episodes` - Static episodes data
- `GET /api/pairings` - Guest-author pairings

## 🔐 Authentication

Token-based auth via middleware:

```typescript
// Required for admin operations
headers: {
  'Authorization': 'Bearer YOUR_ADMIN_TOKEN'
}
```

Set via Wrangler secret:
```bash
wrangler secret put ADMIN_TOKEN
```

## 🧪 Testing

### Test Brainstorm Chat

1. Navigate to `/brainstorm`
2. Click "Start New Brainstorm Session"
3. Send a message: "Help me brainstorm a podcast about AI ethics"
4. Receive AI response using Workers AI model

### Test Podcast Generation

1. Seed guest profiles in D1:
```sql
INSERT INTO guest_profiles (id, name, persona_description, created_at)
VALUES (
  'guest-001',
  'Dr. Joy Buolamwini',
  'AI ethics researcher focused on algorithmic bias and facial recognition. Thoughtful, data-driven, passionate about equity in technology.',
  1234567890000
);
```

2. Create episode in D1:
```sql
INSERT INTO episodes (id, title, description, created_at)
VALUES (
  'ep-001',
  'The Algorithmic Class Divide',
  'Exploring how AI systems perpetuate inequality',
  1234567890000
);
```

3. Link guest to episode:
```sql
INSERT INTO episode_guests (id, episode_id, guest_profile_id, created_at)
VALUES ('link-001', 'ep-001', 'guest-001', 1234567890000);
```

4. Navigate to `/episodes/ep-001`
5. Click "Generate Podcast Demo"
6. Check EpisodeActor status via DO
7. View generated transcript in D1
8. Audio placeholder uploaded to R2

## 🎯 Future Enhancements

### Audio Generation (Stub → Production)

Current AudioDirectorAgent creates placeholder files. To implement real TTS:

**Option 1: Cloudflare Workers AI (when TTS models available)**
```typescript
const audio = await env.AI.run('@cf/tts/model-name', {
  text: segment.text,
  voice: 'andrea-longton'
});
```

**Option 2: External TTS API (ElevenLabs, Azure, etc.)**
```typescript
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech', {
  method: 'POST',
  headers: {
    'xi-api-key': env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: segment.text,
    voice_id: 'host_voice_id'
  })
});
```

### OpenAPI Documentation

Schema infrastructure is in place. To generate docs:

1. Convert routes to use `@hono/zod-openapi`
2. Create OpenAPIHono app
3. Define routes with `.openapi()` method
4. Generate spec at `/openapi.json`

### Advanced Features

- **Real-time streaming** - Use Server-Sent Events for chat
- **Voice upload** - Transcribe user audio with Whisper model
- **Episode editing** - Rich text editor for transcript refinement
- **Guest library** - Browse and search guest profiles
- **Analytics** - Track usage with Cloudflare Analytics Engine

## 📝 Code Quality Standards

All code follows the project's AI-agent readability requirements:

✅ **File-level docstrings** - Every file explains its purpose
✅ **Function-level JSDoc** - All exports have `@param` and `@returns`
✅ **Descriptive naming** - Clear, explicit variable and function names
✅ **Modular architecture** - Separation of concerns
✅ **Type safety** - Full TypeScript typing

## 🆘 Troubleshooting

### "Module not found" errors

Ensure imports use correct paths:
```typescript
// ✅ Correct
import { Bindings } from './types/bindings';
// ❌ Wrong
import { Bindings } from '@/types/bindings';
```

### Durable Objects not working

1. Check wrangler.toml has correct bindings
2. Ensure classes are exported in src/index.ts
3. Verify migration tag matches

### Frontend not loading

1. Run `npm run build:frontend` first
2. Check `/dist` directory exists
3. Verify ASSETS binding in wrangler.toml

### Database errors

Apply migrations:
```bash
npx wrangler d1 migrations apply sji-app-db
```

## 📚 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Hono Framework](https://hono.dev/)
- [Zod Validation](https://zod.dev/)

---

**Implementation Date**: October 2025
**Claude Code Session**: claude/run-prompt-2-011CUdtdwQGXM8s5KQFx4JP3
**Status**: ✅ Complete - Ready for testing and deployment
