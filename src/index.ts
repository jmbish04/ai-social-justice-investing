import { Hono } from 'hono';
import { Bindings, Episode } from './types/bindings';
import apiRoutes from './api/routes';
import newApiRoutes from './api/newRoutes';

// Import page renderers
import { homePage } from './pages/home';
import { episodesPage } from './pages/episodes';
import { researchPage } from './pages/research';
import { pairingsPage } from './pages/pairings';
import { submitPage } from './pages/submit';

// Note: Episodes, research, and pairings are now served via API endpoints
// These JSON imports are kept for backward compatibility only (legacy pages)
import episodesData from './data/episodes.json';
import researchData from './data/research.json';
import pairingsData from './data/pairings.json';

// Export Durable Objects for Cloudflare Workers
export { ChatCoordinatorDO } from './do/ChatCoordinatorDO';
export { EpisodeActor } from './actors/EpisodeActor';

// Create Hono app with type-safe bindings
const app = new Hono<{ Bindings: Bindings }>();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'unknown'
  });
});

// HTML Page Routes
app.get('/', (c) => {
  return c.html(homePage());
});

app.get('/episodes', async (c) => {
  // Try to fetch from D1, fallback to static data
  try {
    const result = await c.env.DB.prepare('SELECT * FROM episodes ORDER BY created_at DESC')
      .all<any>();
    const episodes = (result.results || []).map((row: any): Episode => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      guest: '', // Will be populated from episode_guests if needed
      status: (row.status || 'planned') as 'planned' | 'recorded' | 'published',
      dateCreated: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : undefined,
    }));
    const staticEpisodes = episodesData.map((ep: any): Episode => ({
      ...ep,
      status: ep.status as 'planned' | 'recorded' | 'published',
    }));
    return c.html(episodesPage(episodes.length > 0 ? episodes : staticEpisodes));
  } catch (error) {
    console.error('Error loading episodes from D1, using static data:', error);
    const staticEpisodes = episodesData.map((ep: any): Episode => ({
      ...ep,
      status: ep.status as 'planned' | 'recorded' | 'published',
    }));
    return c.html(episodesPage(staticEpisodes));
  }
});

app.get('/research', async (c) => {
  try {
    // Fetch research entries from D1
    const result = await c.env.DB.prepare(
      'SELECT * FROM research_entries ORDER BY date_added DESC, created_at DESC'
    ).all<any>();
    
    const research = (result.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      domain: row.domain || '',
      chemistry: row.chemistry || '',
      topic: row.topic || '',
      link: row.link || '',
      dateAdded: row.date_added ? new Date(row.date_added * 1000).toISOString().split('T')[0] : undefined,
    }));
    
    return c.html(researchPage(research.length > 0 ? research : researchData));
  } catch (error) {
    console.error('Error loading research from D1, using static data:', error);
    return c.html(researchPage(researchData));
  }
});

app.get('/pairings', async (c) => {
  try {
    // Fetch pairings from D1
    const result = await c.env.DB.prepare(
      'SELECT * FROM pairings ORDER BY confidence_score DESC, created_at DESC'
    ).all<any>();
    
    const pairings = (result.results || []).map((row: any) => {
      let chemistry: string[] = [];
      try {
        chemistry = row.chemistry_tags ? JSON.parse(row.chemistry_tags) : [];
      } catch {
        // If parsing fails, treat as empty
      }
      
      return {
        id: row.id,
        guestName: row.guest_name,
        authorName: row.author_name,
        chemistry,
        topic: row.topic || '',
        reasoning: row.reasoning || '',
        confidenceScore: row.confidence_score || 0,
      };
    });
    
    return c.html(pairingsPage(pairings.length > 0 ? pairings : pairingsData));
  } catch (error) {
    console.error('Error loading pairings from D1, using static data:', error);
    return c.html(pairingsPage(pairingsData));
  }
});

app.get('/submit', (c) => {
  return c.html(submitPage());
});

// API Routes
app.route('/api', apiRoutes);
app.route('/api', newApiRoutes);

// OpenAPI Specification
import { openApiRegistry } from './openapi/spec';
app.route('/', openApiRegistry);

// 404 Handler
app.notFound((c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Page Not Found</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 flex items-center justify-center min-h-screen">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p class="text-xl text-gray-600 mb-8">Page not found</p>
        <a href="/" class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-secondary">
          Go Home
        </a>
      </div>
    </body>
    </html>
  `, 404);
});

// Error Handler
app.onError((err: Error, c) => {
  console.error('Application error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

// Export the app as the default Worker handler
export default app;
