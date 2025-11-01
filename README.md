# Social Justice x AI Dashboard

A Cloudflare Worker-powered web application serving as a public-facing dashboard and private planning workspace for a podcast project exploring **AI, ethics, and social investing**.

## 🌍 Overview

This project combines research from Gemini Deep Research outputs, podcast episode outlines, and pairing suggestions between guests and authors from *The Social Justice Investor* into a single, fast, and globally-distributed dashboard.

**Built with:**
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Hono](https://hono.dev) - Ultra-fast web framework for Workers
- TypeScript - Type-safe development
- Tailwind CSS - Utility-first styling
- Cloudflare KV - Key-value storage for dynamic content

## ✨ Features

### Public Pages
- **Landing Page** (`/`) - Project introduction and navigation
- **Episodes** (`/episodes`) - Browse upcoming podcast topics with status tracking
- **Research** (`/research`) - Interactive table of AI ethics researchers with filtering
- **Pairings** (`/pairings`) - Guest-author matches with chemistry tags and confidence scores
- **Submit** (`/submit`) - Markdown-powered submission form for new ideas

### API Endpoints
- `GET /api/research` - Returns all research entries (JSON)
- `GET /api/episodes` - Returns podcast episodes (JSON)
- `GET /api/pairings` - Returns guest-author pairings (JSON)
- `POST /api/submit` - Saves new ideas to KV storage (requires token)
- `GET /api/ideas` - Returns submitted ideas (requires token)
- `GET /health` - Health check endpoint

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/ai-social-justice-investing.git
cd ai-social-justice-investing

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login
```

### Create KV Namespaces

```bash
# Create production KV namespaces
npx wrangler kv:namespace create IDEAS_KV
npx wrangler kv:namespace create RESEARCH_KV

# Create preview KV namespaces (for development)
npx wrangler kv:namespace create IDEAS_KV --preview
npx wrangler kv:namespace create RESEARCH_KV --preview
```

Copy the IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "IDEAS_KV"
id = "YOUR_IDEAS_KV_ID"
preview_id = "YOUR_IDEAS_KV_PREVIEW_ID"

[[kv_namespaces]]
binding = "RESEARCH_KV"
id = "YOUR_RESEARCH_KV_ID"
preview_id = "YOUR_RESEARCH_KV_PREVIEW_ID"
```

### Set Admin Token (Optional)

If you want to protect the `/submit` endpoint with authentication:

```bash
npx wrangler secret put ADMIN_TOKEN
# Enter your secret token when prompted
```

### Local Development

```bash
# Start the development server
npm run dev

# The app will be available at http://localhost:8787
```

### Deploy to Production

```bash
# Option 1: Full deployment with data import (recommended)
export WORKER_URL="https://social-investing.hacolby.workers.dev"
npm run deploy:import

# Option 2: Step-by-step deployment
npm run deploy              # Build, migrate, and deploy
python3 scripts/import_gemini_research.py \
  --base-url https://social-investing.hacolby.workers.dev \
  --generate-all

# Option 3: Just deploy (no import)
npm run deploy

# Option 4: Push to main for automatic GitHub Actions deployment (if configured)
git push origin main
```

**📖 See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment and import instructions.**

### Import Initial Data

After deployment, import your data:

```bash
# Import JSON data files (episodes.json, research.json, pairings.json)
npm run import:json:remote

# Import Gemini Deep Research data (with guests, episodes, transcripts)
npm run import:gemini
# Or directly:
python3 scripts/import_gemini_research.py --generate-all
```

## 🔧 Configuration

### Environment Variables

Set via `wrangler.toml` or Wrangler CLI:

| Variable | Description | Required |
|----------|-------------|----------|
| `ADMIN_TOKEN` | Secret token for protected routes | No |
| `ENVIRONMENT` | Deployment environment (production/dev) | No |

### KV Namespaces

- **IDEAS_KV**: Stores submitted ideas from the `/submit` form
- **RESEARCH_KV**: Stores additional research entries beyond the JSON file

## 📁 Project Structure

```
ai-social-justice-investing/
├── src/
│   ├── index.ts              # Main Worker entry point
│   ├── api/
│   │   └── routes.ts         # API endpoint handlers
│   ├── data/
│   │   ├── episodes.json     # Podcast episode data
│   │   ├── research.json     # Research database
│   │   └── pairings.json     # Guest-author pairings
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware
│   ├── pages/
│   │   ├── layout.ts         # Base HTML layout
│   │   ├── home.ts           # Landing page
│   │   ├── episodes.ts       # Episodes page
│   │   ├── research.ts       # Research page
│   │   ├── pairings.ts       # Pairings page
│   │   └── submit.ts         # Submission form
│   └── types/
│       └── bindings.ts       # TypeScript types
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions workflow
├── wrangler.toml             # Cloudflare Workers config
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript config
```

## 🔐 Authentication

The `/api/submit` endpoint supports optional token-based authentication:

**Via Header:**
```bash
curl -X POST https://social-investing.hacolby.workers.dev/api/submit \
  -H "Content-Type: application/json" \
  -d '{"type":"episode","content":"# My Idea\n\nDescription here..."}'
```

**Note:** All endpoints are publicly accessible - no authentication required.

## 🎨 Customization

### Adding New Research Entries

Edit `src/data/research.json`:

```json
{
  "id": "r006",
  "name": "Your Researcher",
  "domain": "AI Ethics",
  "chemistry": "Visionary",
  "topic": "Your Research Topic",
  "link": "https://example.com",
  "dateAdded": "2025-10-30"
}
```

### Adding New Episodes

Edit `src/data/episodes.json`:

```json
{
  "id": "e006",
  "title": "Your Episode Title",
  "description": "Episode description...",
  "guest": "Guest description",
  "status": "planned",
  "dateCreated": "2025-10-30"
}
```

### Adding New Pairings

Edit `src/data/pairings.json`:

```json
{
  "id": "p006",
  "guestName": "Guest Name",
  "authorName": "Author Name",
  "chemistry": ["Visionary", "Pragmatist"],
  "topic": "Conversation Topic",
  "reasoning": "Why this pairing works...",
  "confidenceScore": 88
}
```

## 🚀 GitHub Actions Deployment

Automatic deployment is configured via GitHub Actions. To enable:

1. **Create Cloudflare API Token:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Create token with "Edit Cloudflare Workers" permissions

2. **Add GitHub Secrets:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add `CLOUDFLARE_API_TOKEN` (your API token)
   - Add `CLOUDFLARE_ACCOUNT_ID` (found in Workers dashboard)

3. **Push to main:**
   ```bash
   git push origin main
   ```

The workflow will automatically deploy on every push to `main`.

## 📊 Data Models

### ResearchEntry
```typescript
{
  id: string;
  name: string;
  domain: string;
  chemistry: string;
  topic: string;
  link: string;
  dateAdded?: string;
}
```

### Episode
```typescript
{
  id: string;
  title: string;
  description: string;
  guest: string;
  status: 'planned' | 'recorded' | 'published';
  dateCreated?: string;
}
```

### Pairing
```typescript
{
  id: string;
  guestName: string;
  authorName: string;
  chemistry: string[];
  topic: string;
  reasoning: string;
  confidenceScore?: number;
}
```

## 🛠️ Development Commands

```bash
npm run dev        # Start local development server
npm run deploy     # Deploy to Cloudflare Workers
npm run build      # Dry-run build (validate config)
npm run tail       # Stream live logs from production
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by *The Social Justice Investor*
- Built on [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [Hono](https://hono.dev)
- Research synthesis via Gemini Deep Research

---

**Social Justice x AI** - Where algorithmic accountability meets impact investing.
