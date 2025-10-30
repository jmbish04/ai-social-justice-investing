import { Hono } from 'hono';
import { Bindings, ResearchEntry, Episode, Pairing, SubmittedIdea } from '../types/bindings';
import { authMiddleware } from '../middleware/auth';
import researchData from '../data/research.json';
import episodesData from '../data/episodes.json';
import pairingsData from '../data/pairings.json';

const api = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/research
 * Returns all research entries
 */
api.get('/research', async (c) => {
  try {
    // In production, you might fetch additional entries from RESEARCH_KV
    const kvEntries = await c.env.RESEARCH_KV.list();
    const promises = kvEntries.keys.map(async (key) => {
      const value = await c.env.RESEARCH_KV.get(key.name);
      if (value) {
        try {
          return JSON.parse(value) as ResearchEntry;
        } catch (e) {
          console.error(`Failed to parse research entry ${key.name}:`, e);
        }
      }
      return null;
    });
    const additionalResearch = (await Promise.all(promises)).filter((entry): entry is ResearchEntry => entry !== null);

    const allResearch = [...researchData, ...additionalResearch];

    return c.json({
      success: true,
      data: allResearch,
      count: allResearch.length
    });
  } catch (error) {
    console.error('Error fetching research:', error);
    return c.json({ success: false, error: 'Failed to fetch research data' }, 500);
  }
});

/**
 * GET /api/episodes
 * Returns all podcast episodes
 */
api.get('/episodes', async (c) => {
  try {
    const episodes: Episode[] = episodesData;

    // Optional: filter by status
    const status = c.req.query('status');
    const filtered = status
      ? episodes.filter(ep => ep.status === status)
      : episodes;

    return c.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return c.json({ success: false, error: 'Failed to fetch episodes' }, 500);
  }
});

/**
 * GET /api/pairings
 * Returns all guest-author pairings
 */
api.get('/pairings', async (c) => {
  try {
    const pairings: Pairing[] = pairingsData;

    // Optional: sort by confidence score
    const sorted = [...pairings].sort((a, b) =>
      (b.confidenceScore || 0) - (a.confidenceScore || 0)
    );

    return c.json({
      success: true,
      data: sorted,
      count: sorted.length
    });
  } catch (error) {
    console.error('Error fetching pairings:', error);
    return c.json({ success: false, error: 'Failed to fetch pairings' }, 500);
  }
});

/**
 * POST /api/submit
 * Saves a new idea to KV storage
 * Requires authentication
 */
api.post('/submit', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { content, type } = body;

    if (!content || !type) {
      return c.json({
        success: false,
        error: 'Missing required fields: content and type'
      }, 400);
    }

    const idea: SubmittedIdea = {
      id: crypto.randomUUID(),
      content,
      type: type || 'general',
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    // Save to KV
    await c.env.IDEAS_KV.put(idea.id, JSON.stringify(idea));

    return c.json({
      success: true,
      data: idea,
      message: 'Idea submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting idea:', error);
    return c.json({ success: false, error: 'Failed to submit idea' }, 500);
  }
});

/**
 * GET /api/ideas
 * Returns all submitted ideas (admin only)
 */
api.get('/ideas', authMiddleware, async (c) => {
  try {
    const kvEntries = await c.env.IDEAS_KV.list();
    const promises = kvEntries.keys.map(async (key) => {
      const value = await c.env.IDEAS_KV.get(key.name);
      if (value) {
        try {
          return JSON.parse(value) as SubmittedIdea;
        } catch (e) {
          console.error(`Failed to parse idea ${key.name}:`, e);
        }
      }
      return null;
    });
    const ideas = (await Promise.all(promises)).filter((idea): idea is SubmittedIdea => idea !== null);

    // Sort by timestamp (newest first)
    ideas.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return c.json({
      success: true,
      data: ideas,
      count: ideas.length
    });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    return c.json({ success: false, error: 'Failed to fetch ideas' }, 500);
  }
});

export default api;
