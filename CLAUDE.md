# 🤖 CLAUDE.md - AI Agent Instructions

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

## 🧠 Agent Personas

### HostAgent System Prompt

