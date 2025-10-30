Perfect — here’s the follow-up Claude Code prompt focused entirely on creating and wiring up the GeneratePodcastDemoWorkflow and the supporting audio + transcript pipeline for your ai-social-justice-investing repo.

This assumes Claude has already built or knows the repo context (Cloudflare Workers + D1 + R2 + Durable Objects + Agent SDK + React frontend).
You can paste this prompt directly into Claude’s iOS UI as your second iteration after the main prompt we just built.

⸻


You are Claude Code. You are working inside the existing GitHub repo:
**https://github.com/jmbish04/ai-social-justice-investing**

You already created the brainstorm chat and episode chat components.  
Now extend the project by implementing the **AI podcast generation pipeline**, including the durable workflow system that will generate demo podcast audio and transcripts for each episode.

This pipeline must use:
- Cloudflare **Workflows**
- Cloudflare **Queues**
- Cloudflare **Durable Objects**
- Cloudflare **R2**, **D1**, and **Workers AI**
- Cloudflare **Agent SDK**
- **Existing bindings** and IDs from `wrangler.toml` (see below — use exactly these).

---

## ⚙️ USE THESE EXACT BINDINGS

```toml
name = "sji-app"
main = "src/index.ts"
compatibility_date = "2025-10-30"

[[d1_databases]]
binding = "DB"
database_name = "sji-app-db"
database_id = "34b476f8-1f88-4062-816d-2acfb3449a7d"

[[kv_namespaces]]
binding = "KV"
id = "ae22b132a2fd453ca9cc04c1ab3b0da9"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "sji-app-public"

[vars]
R2_PUBLIC_URL = "https://sji-app-public.b3304b14848de15c72c24a14b0cd187d.r2.dev"
MODEL_REASONING = "@cf/meta/llama-3.1-8b-instruct"
MODEL_STT = "@cf/openai/whisper-base-en"


⸻

🧠 OBJECTIVE

Create a workflow-driven AI system that can automatically:
	1.	Take an episode idea or outline.
	2.	Generate a structured transcript (host + guests).
	3.	Simulate guest responses using the AI agents.
	4.	Generate (or stub) audio for each segment.
	5.	Concatenate segments and save them in R2.
	6.	Link outputs to D1 in versioned tables (transcripts, audio_versions).

This should allow Andrea to preview demo podcast episodes for each idea directly in the web UI.

⸻

🧩 SYSTEM COMPONENTS OVERVIEW

1. `src/workflows/generatePodcastDemo.ts`

   * Houses the class-based `GeneratePodcastDemoWorkflow` orchestrator.
   * `run(episodeId, progressCallback?)` performs:
     1. Load episode metadata from D1.
     2. Instantiate Host/Guest agents via `PodcastBuilderAgent.createForEpisode`.
     3. Call `generateTranscriptPackage` to obtain markdown text, segments, and word count.
     4. Compute the next transcript version and insert the transcript row in D1.
     5. Use `AudioDirectorAgent.generateAndUploadAudio` to create/upload a placeholder file in R2.
     6. Persist audio metadata in D1 and return `{ ok, success, transcriptId, transcriptVersion, transcriptWordCount, audioVersionId, audio }`.
   * `triggerPodcastGeneration` coordinates with `EpisodeActor` for serialized execution and status tracking.

2. `src/agents/PodcastBuilderAgent.ts`

   * Extends the multi-guest transcript generator with `generateTranscriptPackage`, returning outline, segments, and metadata consumed by the workflow.
   * Static factory resolves guest personas from `episode_guests`.

3. `src/agents/AudioDirectorAgent.ts`

   * Provides `generateAudio` (in-memory placeholder) and `generateAndUploadAudio` (R2 upload + metadata).
   * Uses deterministic JSON payloads while waiting for Workers AI TTS support.

4. `src/actors/EpisodeActor.ts`

   * Durable Object that ensures only one workflow runs per episode.
   * Tracks `transcriptVersion`, `audioVersionId`, and audio metadata in `state.result` for polling endpoints.

5. API integration

   * `POST /api/episodes/:id/generate-audio` is defined in `src/api/newRoutes.ts` and wired through `src/index.ts`.
   * Returns the workflow payload so the frontend can refresh transcript/audio lists immediately.

6. Database schema

   * `migrations/2025-10-30_add_podcast_tables.sql` establishes the versioned tables actually in use:

```sql
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
```


⸻

8. Frontend Integration

Update Episode Page UI to:
	•	Show a “Generate Demo Podcast” button → calls /api/episodes/:id/generate-audio
	•	Display new audio_versions with player.
	•	Autoplay new audio when ready.

⸻

9. Deliverables

Claude should:
	1.	Create or update:
	•	src/workflows/generatePodcastDemo.ts
	•	src/agents/PodcastBuilderAgent.ts
	•	src/agents/AudioDirectorAgent.ts
	•	src/actors/EpisodeActor.ts
	•	src/index.ts API route
	2.	Add Vitest coverage in src/tests/generatePodcastDemoWorkflow.test.ts and run `npm run test`.
	3.	Apply any required D1 schema migrations.
	4.	Verify R2 writes to BUCKET and URLs resolve under R2_PUBLIC_URL.
	5.	Commit to the repo with message:
“Add GeneratePodcastDemoWorkflow with R2 audio + transcript pipeline”

⸻

Use your cloudflare-docs MCP tool for technical guidance on:
	•	Durable Object registration
	•	Workflow + Queue bindings
	•	R2 put and get syntax
	•	D1 queries
	•	Workers AI inference shape
	•	OpenAPI schema integration for /api/episodes/:id/generate-audio

After this step, the system should fully support creating, versioning, and previewing demo podcast episodes in-app.

---

