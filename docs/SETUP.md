# Setup Guide

This guide will walk you through setting up the Social Justice x AI Dashboard for the first time.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 20+** installed ([download](https://nodejs.org/))
2. **npm** (comes with Node.js)
3. **Git** installed
4. A **Cloudflare account** (free tier works)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install:
- Hono (web framework)
- Wrangler (Cloudflare CLI)
- TypeScript
- Type definitions

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

This will:
- Open your browser
- Ask you to log in to Cloudflare
- Grant access to your account

### 3. Create KV Namespaces

KV namespaces are key-value databases for storing dynamic content.

```bash
# Production namespaces
npx wrangler kv:namespace create IDEAS_KV
npx wrangler kv:namespace create RESEARCH_KV

# Preview namespaces (for local development)
npx wrangler kv:namespace create IDEAS_KV --preview
npx wrangler kv:namespace create RESEARCH_KV --preview
```

Each command will output something like:

```
{ binding = "IDEAS_KV", id = "abc123def456" }
{ binding = "IDEAS_KV", preview_id = "xyz789uvw012" }
```

### 4. Update wrangler.toml

Open `wrangler.toml` and replace the placeholder IDs:

```toml
[[kv_namespaces]]
binding = "IDEAS_KV"
id = "abc123def456"           # <- Your actual ID here
preview_id = "xyz789uvw012"   # <- Your actual preview ID here

[[kv_namespaces]]
binding = "RESEARCH_KV"
id = "ghi456jkl789"           # <- Your actual ID here
preview_id = "mno345pqr678"   # <- Your actual preview ID here
```

### 5. Set Admin Token (Optional but Recommended)

Protect your `/api/submit` endpoint:

```bash
npx wrangler secret put ADMIN_TOKEN
```

When prompted, enter a strong random token:
- Use a password generator
- Make it at least 32 characters
- Mix letters, numbers, and symbols
- Example: `my_secure_token_ABC123xyz789DEF456`

Save this token somewhere safe - you'll need it to submit ideas via the API.

### 6. Test Locally

```bash
npm run dev
```

Visit [http://localhost:8787](http://localhost:8787)

Test each page:
- `/` - Landing page
- `/episodes` - Episodes list
- `/research` - Research database
- `/pairings` - Guest-author matches
- `/submit` - Submission form

### 7. Deploy to Production

```bash
npm run deploy
```

Your app will be deployed to:
```
https://ai-social-justice-investing.YOUR-SUBDOMAIN.workers.dev
```

The URL will be shown in the terminal output.

### 8. Set Up GitHub Actions (Optional)

For automatic deployments on push to `main`:

1. **Get your Cloudflare Account ID:**
   ```bash
   npx wrangler whoami
   ```
   Copy the "Account ID" value.

2. **Create a Cloudflare API Token:**
   - Visit [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use the "Edit Cloudflare Workers" template
   - Click "Continue to summary" → "Create Token"
   - Copy the token (you won't see it again!)

3. **Add GitHub Secrets:**
   - Go to your repo on GitHub
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add these two secrets:
     - Name: `CLOUDFLARE_API_TOKEN`, Value: (your token)
     - Name: `CLOUDFLARE_ACCOUNT_ID`, Value: (your account ID)

4. **Test the workflow:**
   ```bash
   git add .
   git commit -m "Configure deployment"
   git push origin main
   ```

   Check the "Actions" tab on GitHub to see the deployment progress.

## Troubleshooting

### "Error: Missing required field: id"

You forgot to update the KV namespace IDs in `wrangler.toml`. Go back to step 4.

### "Unauthorized" when accessing /api/submit

Either:
- You haven't set `ADMIN_TOKEN` (it's optional in dev mode)
- You're using the wrong token
- You forgot to include the token in your request

To reset the token:
```bash
npx wrangler secret put ADMIN_TOKEN
```

### "Module not found" errors

Make sure you installed dependencies:
```bash
npm install
```

### Port 8787 already in use

Another process is using that port. Either:
- Stop the other process
- Or specify a different port:
  ```bash
  npx wrangler dev --port 8788
  ```

## Next Steps

Once deployed, you can:

1. **Add more research entries** - Edit `src/data/research.json`
2. **Create episode ideas** - Edit `src/data/episodes.json`
3. **Suggest pairings** - Edit `src/data/pairings.json`
4. **Customize the design** - Modify files in `src/pages/`
5. **Add new API endpoints** - Extend `src/api/routes.ts`

## Useful Commands

```bash
npm run dev                    # Local development
npm run deploy                 # Deploy to production
npm run tail                   # View live logs
npx wrangler kv:key list       # List KV keys
npx wrangler secret list       # List secrets
npx wrangler whoami            # Show account info
```

## Need Help?

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Documentation](https://hono.dev)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

Happy building!
