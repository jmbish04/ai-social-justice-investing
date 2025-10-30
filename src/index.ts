import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { authMiddleware } from './middleware/auth';
import apiRoutes from './api/routes';
import newApiRoutes from './api/newRoutes';

// Import page renderers
import { homePage } from './pages/home';
import { episodesPage } from './pages/episodes';
import { researchPage } from './pages/research';
import { pairingsPage } from './pages/pairings';
import { submitPage } from './pages/submit';

// Import data
import episodesData from './data/episodes.json';
import researchData from './data/research.json';
import pairingsData from './data/pairings.json';

// Export Durable Objects for Cloudflare Workers
export { ChatCoordinatorDO } from './do/ChatCoordinatorDO';
export { EpisodeActor } from './actors/EpisodeActor';

// Create Hono app with type-safe bindings
const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', cors({
  origin: ['http://localhost:8787', 'https://your-production-domain.com']
}));

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

app.get('/episodes', (c) => {
  return c.html(episodesPage(episodesData));
});

app.get('/research', async (c) => {
  try {
    // Fetch any additional research from KV
    const kvEntries = await c.env.RESEARCH_KV.list();
    const additionalResearch = [];

    for (const key of kvEntries.keys) {
      const value = await c.env.RESEARCH_KV.get(key.name);
      if (value) {
        try {
          additionalResearch.push(JSON.parse(value));
        } catch (e) {
          console.error(`Failed to parse research entry ${key.name}:`, e);
        }
      }
    }

    const allResearch = [...researchData, ...additionalResearch];
    return c.html(researchPage(allResearch));
  } catch (error) {
    console.error('Error loading research page:', error);
    return c.html(researchPage(researchData));
  }
});

app.get('/pairings', (c) => {
  return c.html(pairingsPage(pairingsData));
});

app.get('/submit', (c) => {
  return c.html(submitPage());
});

// API Routes
app.route('/api', apiRoutes);
app.route('/api', newApiRoutes);

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
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

// Export the app as the default Worker handler
export default app;
