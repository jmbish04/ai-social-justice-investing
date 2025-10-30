# 🤖 AGENTS.md - AI Agent Instructions

You are Claude Code. You are working inside the existing GitHub repo:
**https://github.com/jmbish04/ai-social-justice-investing**

Your goal is to **extend the existing codebase** — not replace it. Follow all instructions in this file when making changes.

---

## 📜 Core Mission

Your primary task is to evolve this repository by implementing AI-driven chat interfaces and a podcast generation pipeline. All features must be built using the Cloudflare-native stack (Workers, D1, R2, Agents, Actors) and a static React frontend.

---

## ⭐️ CRITICAL: Code Quality & Style

This repository is **owned and maintained by AI developer agents**. Your code MUST be optimized for them.

1.  **AI-Agent Readability (Mandatory):**
    * **File-Level Docstrings:** Every new `.ts` and `.tsx` file **MUST** begin with a top-level docstring (`/** ... */`) explaining its purpose and its role in the application.
    * **Block-Level Docstrings:** All public functions, classes, methods, and complex logic blocks **MUST** have clear JSDoc-style docstrings explaining their function, parameters (`@param`), and return values (`@returns`).
    * **Clarity Over Brevity:** Use descriptive variable names and explicit logic.

2.  **Modularity:**
    * Write clean, highly modular TypeScript.
    * Create separate files for distinct concerns (routes, schemas, services, agents, actors).
    * Preserve and extend the existing repo structure.

3.  **Cloudflare Best Practices:**
    * Use the `cloudflare-docs` MCP to verify all Cloudflare-specific API patterns and configurations.
    * **NEVER** use placeholder bindings.

---

## ⚙️ Core Architecture & Bindings

Use these **exact** bindings from `wrangler.toml` in all your code.

| Binding Type | Binding Name | Service |
| :--- | :--- | :--- |
| D1 Database | `DB` | `sji-app-db` |
| R2 Bucket | `BUCKET` | `sji-app-public` |
| KV Namespace | `KV` | (ID: `...0da9`) |
| AI Model | `MODEL_REASONING` | `@cf/meta/llama-3.1-8b-instruct` |
| AI Model | `MODEL_STT` | `@cf/openai/whisper-base-en` |
| Env Variable | `R2_PUBLIC_URL` | `https://sji-app-public...r2.dev` |

**Tech Stack:**
* **Backend:** Hono on Cloudflare Workers
* **Frontend:** React + Vite (built to `/dist` and served via `ASSETS` binding)
* **Database:** D1 (`DB`)
* **Storage:** R2 (`BUCKET`)
* **Orchestration:** Cloudflare Agents, Actors (`EpisodeActor`), Durable Objects (`ChatCoordinatorDO`), and Workflows/Queues.
* **API Docs:** `@hono/zod-openapi` to generate `/openapi.json` dynamically.

---

## 🧩 Key Features to Evolve

* **Brainstorm Chat (`/brainstorm`):** Vercel Chat SDK interface for ideation, backed by Workers AI and `ChatCoordinatorDO`.
* **Episode Chat (`/episodes/:id`):** Interface for editing transcripts and generating audio, with a multi-guest-aware chat sidebar.
* **Multi-Guest Pipeline:**
    * The `episodes` are linked to multiple `guest_profiles` via the `episode_guests` join table.
    * The `GeneratePodcastDemoWorkflow` must instantiate multiple `GuestAgent`s (one for each linked profile) and orchestrate a multi-way conversation with the `HostAgent`.
* **Persistent Audio Player:** A root-level React Context (`AudioPlayerRoot.tsx`) for sticky, iOS-compatible playback.

---

## 🎛 Backend Components

### PodcastBuilderAgent (`src/agents/PodcastBuilderAgent.ts`)
- Coordinates Host and Guest agents to create structured multi-speaker transcripts.
- `generateTranscriptPackage` returns markdown text, resolved outline, transcript segments, and word count for workflow consumers.
- Static factory `createForEpisode` loads guest personas from D1.

### AudioDirectorAgent (`src/agents/AudioDirectorAgent.ts`)
- Produces placeholder audio metadata while Workers AI TTS is unavailable.
- `generateAudio` returns an in-memory buffer + metadata, and `generateAndUploadAudio` stores concatenated segments in R2.

### GeneratePodcastDemoWorkflow (`src/workflows/generatePodcastDemo.ts`)
- Class-based orchestrator with `run(episodeId)` that persists transcripts in D1, uploads audio to R2, and reports progress.
- Returns `{ ok, success, transcriptId, transcriptVersion, transcriptWordCount, audioVersionId, audio }` for API consumers.

### EpisodeActor (`src/actors/EpisodeActor.ts`)
- Durable Object providing serialized workflow execution and status polling.
- Persists `transcriptVersion` plus audio metadata in `state.result` for client polling.

### API Route (`POST /api/episodes/:id/generate-audio`)
- Defined in `src/api/newRoutes.ts` (mounted via `src/index.ts`).
- Calls `triggerPodcastGeneration` and responds with the workflow payload described above.

### Database Migrations
- `migrations/2025-10-30_add_podcast_tables.sql` defines `transcripts` and `audio_versions` tables with versioning, metadata, and indexes.

### API Extensions
- `GET /api/episodes/:id/transcripts` / `POST` / `PATCH` provide transcript management.
- `GET /api/episodes/:id/audio-versions` exposes R2 audio metadata.
- `GET /api/episodes/:id/workflow-status` proxies the `EpisodeActor` state for polling.
- `DELETE /api/episodes/:id/guests/:guestId` removes guest assignments.

### Frontend UI
- `frontend/src/ui/audio/AudioPlayerRoot.tsx` renders the persistent playback bar powered by `useAudioPlayer`.
- `frontend/src/ui/episodes/EpisodeView.tsx` orchestrates transcript editing, audio playback, and guest coordination.
- Supporting components (`ProgressOverlay`, `VersionSelector`, `StatusBadge`, `GuestManager`, `TranscriptEditor`, `EpisodeChat`) live under `frontend/src/ui/` and should be reused where possible.
- `frontend/src/ui/brainstorm/BrainstormChat.tsx` encapsulates brainstorm flow with episode promotion actions.

### Testing
- `npm run test` executes the Vitest suite.
- `src/tests/generatePodcastDemoWorkflow.test.ts` validates transcript versioning, audio metadata persistence, and workflow error handling with an in-memory D1 mock.
- `frontend/src/contexts/__tests__/AudioPlayerContext.test.tsx` verifies audio player persistence and localStorage syncing for the React UI.

- Test setup stubs live audio playback via `vitest.setup.ts`.

---

## 🧠 Agent Personas

### HostAgent System Prompt


You are Andrea Longton’s AI co-host.
You embody her optimistic and practical tone from The Social Justice Investor.
Focus on equity, access, and systems repair.
Be warm, informed, and bridge finance with ethics.

### GuestAgent Logic

`GuestAgent`s are dynamic. They are instantiated by the workflow, and their persona is loaded from the `guest_profiles` table in D1 based on the guests associated with the specific episode.

---

## 🚀 Deployment

Ensure all code changes are deployable and that D1 migrations are included.

```bash
# 1. Apply Database Migrations
npx wrangler d1 migrations apply sji-app-db

# 2. Publish Worker
npx wrangler publish


