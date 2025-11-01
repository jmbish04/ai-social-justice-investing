# API Endpoints Reference

Base URL: **https://social-investing.hacolby.workers.dev**

All endpoints are publicly accessible - no authentication required.

## 🎙️ Episodes

### List Episodes
```bash
GET /api/episodes
```

Query parameters:
- `status` (optional): Filter by status (`planned`, `recorded`, `published`)
- `sort` (optional): Sort order (`created_at` or `title`)

### Create Episode
```bash
POST /api/episodes
Content-Type: application/json

{
  "id": "optional-custom-id",
  "title": "Episode Title",
  "description": "Episode description",
  "status": "planned"
}
```

### Get Episode
```bash
GET /api/episodes/:id
```

### Update Episode
```bash
PUT /api/episodes/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "recorded"
}
```

### Delete Episode
```bash
DELETE /api/episodes/:id
```

## 👥 Guest Profiles

### List Guest Profiles
```bash
GET /api/guest-profiles
```

### Create Guest Profile
```bash
POST /api/guest-profiles
Content-Type: application/json

{
  "name": "Guest Name",
  "persona_description": "Detailed persona description",
  "expertise": "AI Ethics",
  "tone": "Visionary",
  "background": "Background information"
}
```

### Get Guest Profile
```bash
GET /api/guest-profiles/:id
```

## 🔗 Episode Guests

### List Episode Guests
```bash
GET /api/episodes/:id/guests
```

### Add Guest to Episode
```bash
POST /api/episodes/:id/guests
Content-Type: application/json

{
  "guestProfileId": "guest-profile-id"
}
```

### Remove Guest from Episode
```bash
DELETE /api/episodes/:id/guests/:guestId
```

## 📝 Transcripts

### List Episode Transcripts
```bash
GET /api/episodes/:id/transcripts
```

### Create Transcript (Manual)
```bash
POST /api/episodes/:id/transcripts
Content-Type: application/json

{
  "body": "Transcript markdown content"
}
```

### Update Transcript
```bash
PATCH /api/episodes/:id/transcripts/:transcriptId
Content-Type: application/json

{
  "body": "Updated transcript content"
}
```

### Generate Transcript (AI)
```bash
POST /api/episodes/:id/generate-transcript
Content-Type: application/json

{
  "outline": "optional outline",
  "regenerate": false
}
```

## 🎵 Audio

### List Audio Versions
```bash
GET /api/episodes/:id/audio-versions
```

### Generate Audio
```bash
POST /api/episodes/:id/generate-audio
Content-Type: application/json

{
  "transcriptId": "optional-transcript-id",
  "transcriptVersion": 1
}
```

### Get Workflow Status
```bash
GET /api/episodes/:id/workflow-status
```

Returns real-time status of transcript/audio generation workflow.

## 🔬 Research Entries

### List Research Entries
```bash
GET /api/research
```

Query parameters:
- `domain` (optional): Filter by domain
- `name` (optional): Search by name (LIKE)
- `sort` (optional): Sort order (`date` or `name`)

### Create Research Entry
```bash
POST /api/research
Content-Type: application/json

{
  "name": "Researcher Name",
  "domain": "AI Ethics",
  "chemistry": "Visionary",
  "topic": "Research Topic",
  "link": "https://example.com",
  "dateAdded": "2025-10-30"
}
```

### Update Research Entry
```bash
PUT /api/research/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "domain": "Updated Domain"
}
```

### Delete Research Entry
```bash
DELETE /api/research/:id
```

## 🤝 Pairings

### List Pairings
```bash
GET /api/pairings
```

Query parameters:
- `guestName` (optional): Filter by guest name
- `authorName` (optional): Filter by author name
- `sort` (optional): Sort order (`confidence`, `guest`, `author`)

### Create Pairing
```bash
POST /api/pairings
Content-Type: application/json

{
  "guestName": "Guest Name",
  "authorName": "Author Name",
  "chemistry": ["Visionary", "Tech-Forward"],
  "topic": "Conversation Topic",
  "reasoning": "Why this pairing works",
  "confidenceScore": 95
}
```

### Update Pairing
```bash
PUT /api/pairings/:id
Content-Type: application/json

{
  "guestName": "Updated Guest",
  "confidenceScore": 98
}
```

### Delete Pairing
```bash
DELETE /api/pairings/:id
```

## 💡 Ideas

### List Ideas
```bash
GET /api/ideas
```

Query parameters:
- `status` (optional): Filter by status
- `type` (optional): Filter by type

### Create Idea
```bash
POST /api/ideas
Content-Type: application/json

{
  "content": "Idea content in markdown",
  "type": "episode",
  "threadId": "optional-thread-id"
}
```

## 💬 Brainstorm

### Create Thread
```bash
POST /api/threads
Content-Type: application/json

{
  "title": "Thread Title"
}
```

### Get Thread
```bash
GET /api/threads/:id
```

### Get Thread Messages
```bash
GET /api/threads/:id/messages
```

### Send Message
```bash
POST /api/brainstorm/:threadId/reply
Content-Type: application/json

{
  "message": "Your message here"
}
```

## 📤 Submit

### Submit Idea
```bash
POST /api/submit
Content-Type: application/json

{
  "type": "episode",
  "content": "# Your Idea\n\nMarkdown content here"
}
```

## ❤️ Health

### Health Check
```bash
GET /health
```

---

## Quick Test Commands

```bash
# Base URL
API_URL="https://social-investing.hacolby.workers.dev"

# Health check
curl "$API_URL/health"

# List episodes
curl "$API_URL/api/episodes"

# List guest profiles
curl "$API_URL/api/guest-profiles"

# List research entries
curl "$API_URL/api/research"

# List pairings
curl "$API_URL/api/pairings"

# Get workflow status for an episode
curl "$API_URL/api/episodes/{episodeId}/workflow-status"
```

