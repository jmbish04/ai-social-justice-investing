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

🧩 SYSTEM COMPONENTS TO CREATE

1. src/workflows/generatePodcastDemo.ts

This is the main orchestrator.
Define a GeneratePodcastDemoWorkflow with the following logic:

// Pseudocode sketch:
workflow GeneratePodcastDemoWorkflow(episodeId) {
  // Step 1: Fetch episode and latest outline
  const episode = await DB.prepare("SELECT * FROM episodes WHERE id=?").bind(episodeId).first();
  const outline = episode.outline || {};

  // Step 2: Build transcript
  const transcriptAgent = new PodcastBuilderAgent(env);
  const transcript = await transcriptAgent.generateTranscript(outline);

  // Step 3: Create D1 transcript version
  const version = Date.now();
  const transcriptId = crypto.randomUUID();
  await DB.prepare(`
    INSERT INTO transcripts (id, episode_id, version, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(transcriptId, episodeId, version, transcript.text, Date.now()).run();

  // Step 4: Generate host + guest audio (stub if no TTS)
  const audioAgent = new AudioDirectorAgent(env);
  const audioResult = await audioAgent.generateAudio(transcript.text);

  // Step 5: Save audio to R2
  const r2Key = `podcasts/${episodeId}/v${version}.mp3`;
  await env.BUCKET.put(r2Key, audioResult.buffer, { httpMetadata: { contentType: "audio/mpeg" } });
  const r2Url = `${env.R2_PUBLIC_URL}/${r2Key}`;

  // Step 6: Write audio version record
  const audioId = crypto.randomUUID();
  await DB.prepare(`
    INSERT INTO audio_versions (id, episode_id, transcript_id, version, r2_key, r2_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(audioId, episodeId, transcriptId, version, r2Key, r2Url, Date.now()).run();

  // Step 7: Return success summary
  return { ok: true, episodeId, version, r2Url, transcriptId };
}

Expose an API route /api/episodes/:id/generate-audio that enqueues this workflow (via Queues API).

⸻

2. src/workflows/queueHandlers.ts

Define queue consumers for background jobs like:
	•	generate-transcript
	•	generate-audio
	•	finalize-podcast

Each should call the agents sequentially and report progress.

Example job payload:

{
  "episodeId": "uuid",
  "step": "generate-transcript",
  "context": { "outline": "..." }
}


⸻

3. src/agents/PodcastBuilderAgent.ts

Implements transcript creation using Workers AI.

export class PodcastBuilderAgent {
  constructor(env) { this.env = env; }

  async generateTranscript(outline) {
    const prompt = `
      You are a social impact podcast writer.
      Create a short, 3-segment dialogue between host and guest based on this outline:
      ${JSON.stringify(outline, null, 2)}
    `;
    const res = await this.env.AI.run(this.env.MODEL_REASONING, { prompt });
    return { text: res.output_text };
  }
}


⸻

4. src/agents/AudioDirectorAgent.ts

Manages TTS generation (stub out if unavailable).

export class AudioDirectorAgent {
  constructor(env) { this.env = env; }

  async generateAudio(transcriptText) {
    // TODO: Replace with real TTS once available.
    // For now, return a silent audio placeholder.
    const silence = new ArrayBuffer(1024);
    return { buffer: silence, meta: { duration: 0 } };
  }
}


⸻

5. src/actors/EpisodeActor.ts

Implements serialized handling of workflows per episode.

export class EpisodeActor {
  async startWorkflow(episodeId) {
    const workflow = new GeneratePodcastDemoWorkflow();
    return await workflow.run(episodeId);
  }
}


⸻

6. Hono API Endpoint

Extend /src/index.ts:

app.post('/api/episodes/:id/generate-audio', async (c) => {
  const episodeId = c.req.param('id');
  const workflow = new GeneratePodcastDemoWorkflow(c.env);
  const result = await workflow.run(episodeId);
  return c.json(result);
});

Return a JSON response including the generated r2Url.

⸻

7. Database Links

Ensure D1 has:

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id)
);

CREATE TABLE IF NOT EXISTS audio_versions (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  transcript_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id),
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
);


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
	2.	Apply any required D1 schema migrations.
	3.	Verify R2 writes to BUCKET and URLs resolve under R2_PUBLIC_URL.
	4.	Commit to the repo with message:
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

