Perfect — here’s your PROMPT_4.md, ready to drop directly into your GitHub repo (ai-social-justice-investing).
This prompt assumes that PROMPT_2.md and PROMPT_3.md are already in the repo and have been executed by Claude Code to build the full backend and frontend.
PROMPT_4.md focuses purely on frontend integration and user flow completion: connecting podcast generation, editing, and playback into one cohesive experience.

⸻

📄 PROMPT_4.md

# PROMPT_4.md — Claude Code Frontend Integration and End-to-End UX Pass

You are Claude Code.  
You are working inside the repository:

> https://github.com/jmbish04/ai-social-justice-investing

Your task is to **complete the frontend integration layer** — wiring together the podcast generation pipeline, audio playback, and transcript editing UI into a fully usable experience.  
All logic and backend APIs already exist from previous prompts (`PROMPT_2.md` and `PROMPT_3.md`).

---

## 🎯 GOALS

Integrate the following UI/UX flows using the existing React + Cloudflare Workers architecture:

### 1. “Generate Demo Podcast” Flow
- When the user clicks **Generate Demo Podcast**, trigger the `/api/episodes/:id/generate-audio` endpoint.
- While the podcast is generating:
  - Display progress status (“Creating outline,” “Synthesizing guest dialogue,” “Building audio…”).
  - Poll the workflow status every few seconds until completion.
- Once complete:
  - Show the newly generated transcript (from D1).
  - Add a new version entry to the “Audio Versions” list.
  - Play the new R2-hosted audio file in the persistent player.

### 2. Persistent Audio Player Integration
- Implement a **global `<AudioPlayerRoot />`** using React Context.
- It should:
  - Play audio from any episode page.
  - Stay visible and keep playing even when navigating between pages.
  - Support iOS background playback and proper Safari WebKit media controls.
  - Save last-played timestamp in localStorage (resume on reload).
- When a new podcast is generated, enqueue it automatically and start playback.

### 3. Transcript Editor + Live Sync
- Enable the **Rich Text Editor** on each episode page for transcript editing.
- Implement autosave (every 5s or on blur) to `/api/episodes/:id/transcripts`.
- Add “Save as New Version” to trigger a version increment in D1.
- When editing, display “Draft” status until saved.
- Once saved, the user can:
  - Re-run “Generate Demo Podcast” to produce new audio from the edited transcript.
  - Compare versions side-by-side using a simple diff view (`diff-match-patch` or similar lightweight lib).

### 4. Multi-Guest Display
- Display assigned guests (from `/api/episodes/:id/guests`) with their persona taglines.
- Allow removal or addition of guests inline (dropdown or modal).
- Ensure guest avatars (or initials) appear in the “Discussion Preview” sidebar and transcript editor header.

### 5. Brainstorm Thread Integration
- Add quick action: **“Promote to Episode”** on any brainstorm idea.
  - POSTs to `/api/episodes` to create a new episode pre-filled with that idea.
  - Redirect user to `/episodes/:id`.

---

## ⚙️ TECHNICAL IMPLEMENTATION NOTES

- All UI components must use:
  - **Vercel Chat SDK** for live brainstorm and episode chat threads.
  - **Vercel Stream UI SDK** for streamed AI responses.
- Maintain a **clean, modular React structure**:

src/ui/
├── brainstorm/
│   └── BrainstormChat.tsx
├── episodes/
│   ├── EpisodeChat.tsx
│   ├── TranscriptEditor.tsx
│   ├── GuestManager.tsx
│   └── EpisodeView.tsx
├── audio/
│   ├── AudioPlayerRoot.tsx
│   └── useAudioPlayer.ts
└── components/
├── ProgressOverlay.tsx
├── VersionSelector.tsx
└── StatusBadge.tsx

- All frontend assets are served via the `ASSETS` binding.
- Use the existing Hono `/api` routes for all persistence.
- Use your `cloudflare-docs` MCP to confirm correct streaming/chat SDK imports and Worker asset bundling patterns.

---

## 🧱 REQUIRED FILES TO ADD OR MODIFY

| File | Purpose |
|------|----------|
| `src/ui/episodes/EpisodeView.tsx` | Main view that orchestrates transcript, guests, and audio. |
| `src/ui/audio/AudioPlayerRoot.tsx` | Global audio player with React context. |
| `src/ui/audio/useAudioPlayer.ts` | Hook for controlling audio playback across pages. |
| `src/ui/episodes/TranscriptEditor.tsx` | Rich editor with autosave and diff view. |
| `src/ui/components/ProgressOverlay.tsx` | Handles podcast generation progress UI. |
| `src/ui/components/VersionSelector.tsx` | Dropdown to select transcript/audio versions. |
| `src/ui/components/StatusBadge.tsx` | Reusable visual component for episode/idea states. |

Each component must include:
- File-level JSDoc (`/** Purpose, role, dependencies */`)
- Function-level JSDoc (`@param`, `@returns`, etc.)
- Explicit typing for all props and state
- Minimal dependencies (no heavy UI libs; Tailwind preferred)

---

## 🧠 UX BEHAVIOR SUMMARY

| Flow | Event | Result |
|------|--------|---------|
| Generate Demo Podcast | POST `/api/episodes/:id/generate-audio` | Creates new transcript + audio version |
| Autosave Transcript | Edit detected | PATCH `/api/episodes/:id/transcripts` |
| Add Guest | POST `/api/episodes/:id/guests` | Guest appears immediately in sidebar |
| Remove Guest | DELETE `/api/episodes/:id/guests/:guestId` | Guest disappears from sidebar |
| Promote Idea | Click "Promote to Episode" | Redirect to new `/episodes/:id` |
| Play Audio | Click episode or global player | Sticky playback persists across routes |

---

## 🚀 DEPLOYMENT VALIDATION

After implementation, run:

```bash
npm run build
npx wrangler d1 migrations apply sji-app-db
npx wrangler dev

Verify that:
	•	/brainstorm page saves and promotes ideas.
	•	/episodes/:id supports multi-guest, editable transcript, and “Generate Demo Podcast”.
	•	Global player persists across navigation.
	•	All OpenAPI routes return valid JSON/YAML.

⸻

✅ DELIVERABLES

Claude should:
	1.	Detect existing frontend structure and append to it.
	2.	Create or update the files listed above.
	3.	Commit and push changes in logical increments.
	4.	Ensure /brainstorm and /episodes/:id render complete, functional UI flows.
	5.	Confirm AudioPlayerRoot functions seamlessly on iOS Safari.

Once complete, the repo should support end-to-end creation, editing, generation, and playback of podcast demos with multiple guests — powered entirely by Cloudflare Workers and Vercel SDKs.

---
