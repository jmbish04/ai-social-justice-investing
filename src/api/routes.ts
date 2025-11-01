/**
 * Legacy API routes migrated from JSON files to D1
 * 
 * This module provides comprehensive CRUD operations for:
 * - Research entries (guest research profiles)
 * - Episodes (podcast episodes)
 * - Pairings (guest-author pairings)
 * 
 * All data is now stored in D1 for better scalability and consistency.
 * 
 * @module api/routes
 */

import { Hono } from 'hono';
import { Bindings, ResearchEntry, Episode, Pairing, SubmittedIdea } from '../types/bindings';

const api = new Hono<{ Bindings: Bindings }>();

/**
 * ============================================
 * RESEARCH ENTRIES
 * ============================================
 */

/**
 * GET /api/research
 * Get all research entries from D1
 * Query params: ?domain=, ?name=, ?sort=name|date
 */
api.get('/research', async (c) => {
  try {
    const domain = c.req.query('domain');
    const name = c.req.query('name');
    const sort = c.req.query('sort') || 'date';

    let query = 'SELECT * FROM research_entries WHERE 1=1';
    const params: any[] = [];

    if (domain) {
      query += ' AND domain = ?';
      params.push(domain);
    }

    if (name) {
      query += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }

    // Default sort by date_added DESC, or name ASC
    if (sort === 'name') {
      query += ' ORDER BY name ASC';
    } else {
      query += ' ORDER BY date_added DESC, created_at DESC';
    }

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .all<ResearchEntry>();

    const entries = (result.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      domain: row.domain || '',
      chemistry: row.chemistry || '',
      topic: row.topic || '',
      link: row.link || '',
      dateAdded: row.date_added ? new Date(row.date_added * 1000).toISOString().split('T')[0] : undefined,
    }));

    return c.json({
      success: true,
      data: entries,
      count: entries.length
    });
  } catch (error) {
    console.error('Error fetching research:', error);
    return c.json({ success: false, error: 'Failed to fetch research data' }, 500);
  }
});

/**
 * POST /api/research
 * Create a new research entry
 */
api.post('/research', async (c) => {
  try {
    const body = await c.req.json();
    const { name, domain, chemistry, topic, link } = body;

    if (!name) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const dateAdded = body.dateAdded 
      ? Math.floor(new Date(body.dateAdded).getTime() / 1000)
      : Math.floor(now / 1000);

    await c.env.DB.prepare(
      'INSERT INTO research_entries (id, name, domain, chemistry, topic, link, date_added, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, name, domain || null, chemistry || null, topic || null, link || null, dateAdded, now)
      .run();

    const entry = await c.env.DB.prepare('SELECT * FROM research_entries WHERE id = ?')
      .bind(id)
      .first<ResearchEntry>();

    return c.json({ success: true, data: entry }, 201);
  } catch (error) {
    console.error('Error creating research entry:', error);
    return c.json({ success: false, error: 'Failed to create research entry' }, 500);
  }
});

/**
 * PUT /api/research/:id
 * Update a research entry
 */
api.put('/research/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, domain, chemistry, topic, link, dateAdded } = body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (domain !== undefined) {
      updates.push('domain = ?');
      params.push(domain);
    }
    if (chemistry !== undefined) {
      updates.push('chemistry = ?');
      params.push(chemistry);
    }
    if (topic !== undefined) {
      updates.push('topic = ?');
      params.push(topic);
    }
    if (link !== undefined) {
      updates.push('link = ?');
      params.push(link);
    }
    if (dateAdded !== undefined) {
      updates.push('date_added = ?');
      params.push(Math.floor(new Date(dateAdded).getTime() / 1000));
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    params.push(Date.now(), id);

    await c.env.DB.prepare(
      `UPDATE research_entries SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    const entry = await c.env.DB.prepare('SELECT * FROM research_entries WHERE id = ?')
      .bind(id)
      .first<ResearchEntry>();

    if (!entry) {
      return c.json({ success: false, error: 'Research entry not found' }, 404);
    }

    return c.json({ success: true, data: entry });
  } catch (error) {
    console.error('Error updating research entry:', error);
    return c.json({ success: false, error: 'Failed to update research entry' }, 500);
  }
});

/**
 * DELETE /api/research/:id
 * Delete a research entry
 */
api.delete('/research/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await c.env.DB.prepare('DELETE FROM research_entries WHERE id = ?')
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Research entry not found' }, 404);
    }

    return c.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting research entry:', error);
    return c.json({ success: false, error: 'Failed to delete research entry' }, 500);
  }
});

/**
 * ============================================
 * EPISODES
 * ============================================
 */

/**
 * GET /api/episodes
 * Get all episodes from D1
 * Query params: ?status=, ?sort=created_at|title
 */
api.get('/episodes', async (c) => {
  try {
    // Note: status field may not exist in episodes table yet
    // We'll handle this gracefully
    const sort = c.req.query('sort') || 'created_at';

    let query = 'SELECT * FROM episodes';
    const params: any[] = [];

    // Try to filter by status if column exists (graceful degradation)
    const status = c.req.query('status');
    if (status) {
      // Check if status column exists by trying a query
      try {
        query += ' WHERE status = ?';
        params.push(status);
      } catch {
        // Column doesn't exist, ignore filter
      }
    }

    if (sort === 'title') {
      query += ' ORDER BY title ASC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .all<any>();

    const episodes = (result.results || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      guest: '', // Legacy field, will be populated from episode_guests if needed
      status: row.status || 'planned', // Default if status column doesn't exist
      dateCreated: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return c.json({
      success: true,
      data: episodes,
      count: episodes.length
    });
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return c.json({ success: false, error: 'Failed to fetch episodes' }, 500);
  }
});

/**
 * PUT /api/episodes/:id
 * Update an episode
 */
api.put('/episodes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, description, status } = body;

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    // Status column may not exist, handle gracefully
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    params.push(Date.now(), id);

    await c.env.DB.prepare(
      `UPDATE episodes SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    const episode = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
      .bind(id)
      .first<any>();

    if (!episode) {
      return c.json({ success: false, error: 'Episode not found' }, 404);
    }

    return c.json({ success: true, data: episode });
  } catch (error) {
    console.error('Error updating episode:', error);
    return c.json({ success: false, error: 'Failed to update episode' }, 500);
  }
});

/**
 * DELETE /api/episodes/:id
 * Delete an episode
 */
api.delete('/episodes/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await c.env.DB.prepare('DELETE FROM episodes WHERE id = ?')
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Episode not found' }, 404);
    }

    return c.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting episode:', error);
    return c.json({ success: false, error: 'Failed to delete episode' }, 500);
  }
});

/**
 * ============================================
 * PAIRINGS
 * ============================================
 */

/**
 * GET /api/pairings
 * Get all pairings from D1
 * Query params: ?guestName=, ?authorName=, ?sort=confidence|guest|author
 */
api.get('/pairings', async (c) => {
  try {
    const guestName = c.req.query('guestName');
    const authorName = c.req.query('authorName');
    const sort = c.req.query('sort') || 'confidence';

    let query = 'SELECT * FROM pairings WHERE 1=1';
    const params: any[] = [];

    if (guestName) {
      query += ' AND guest_name LIKE ?';
      params.push(`%${guestName}%`);
    }

    if (authorName) {
      query += ' AND author_name LIKE ?';
      params.push(`%${authorName}%`);
    }

    // Sort options
    if (sort === 'guest') {
      query += ' ORDER BY guest_name ASC';
    } else if (sort === 'author') {
      query += ' ORDER BY author_name ASC';
    } else {
      query += ' ORDER BY confidence_score DESC, created_at DESC';
    }

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .all<any>();

    const pairings = (result.results || []).map((row: any) => {
      let chemistry: string[] = [];
      try {
        chemistry = row.chemistry_tags ? JSON.parse(row.chemistry_tags) : [];
      } catch {
        // If parsing fails, treat as string array or empty
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

    return c.json({
      success: true,
      data: pairings,
      count: pairings.length
    });
  } catch (error) {
    console.error('Error fetching pairings:', error);
    return c.json({ success: false, error: 'Failed to fetch pairings' }, 500);
  }
});

/**
 * POST /api/pairings
 * Create a new pairing
 */
api.post('/pairings', async (c) => {
  try {
    const body = await c.req.json();
    const { guestName, authorName, chemistry, topic, reasoning, confidenceScore } = body;

    if (!guestName || !authorName) {
      return c.json({ success: false, error: 'Guest name and author name are required' }, 400);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO pairings (id, guest_name, author_name, chemistry_tags, topic, reasoning, confidence_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        id,
        guestName,
        authorName,
        chemistry ? JSON.stringify(chemistry) : null,
        topic || null,
        reasoning || null,
        confidenceScore || null,
        now
      )
      .run();

    const pairing = await c.env.DB.prepare('SELECT * FROM pairings WHERE id = ?')
      .bind(id)
      .first<any>();

    return c.json({ success: true, data: pairing }, 201);
  } catch (error) {
    console.error('Error creating pairing:', error);
    return c.json({ success: false, error: 'Failed to create pairing' }, 500);
  }
});

/**
 * PUT /api/pairings/:id
 * Update a pairing
 */
api.put('/pairings/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { guestName, authorName, chemistry, topic, reasoning, confidenceScore } = body;

    const updates: string[] = [];
    const params: any[] = [];

    if (guestName !== undefined) {
      updates.push('guest_name = ?');
      params.push(guestName);
    }
    if (authorName !== undefined) {
      updates.push('author_name = ?');
      params.push(authorName);
    }
    if (chemistry !== undefined) {
      updates.push('chemistry_tags = ?');
      params.push(JSON.stringify(chemistry));
    }
    if (topic !== undefined) {
      updates.push('topic = ?');
      params.push(topic);
    }
    if (reasoning !== undefined) {
      updates.push('reasoning = ?');
      params.push(reasoning);
    }
    if (confidenceScore !== undefined) {
      updates.push('confidence_score = ?');
      params.push(confidenceScore);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    params.push(Date.now(), id);

    await c.env.DB.prepare(
      `UPDATE pairings SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    const pairing = await c.env.DB.prepare('SELECT * FROM pairings WHERE id = ?')
      .bind(id)
      .first<any>();

    if (!pairing) {
      return c.json({ success: false, error: 'Pairing not found' }, 404);
    }

    return c.json({ success: true, data: pairing });
  } catch (error) {
    console.error('Error updating pairing:', error);
    return c.json({ success: false, error: 'Failed to update pairing' }, 500);
  }
});

/**
 * DELETE /api/pairings/:id
 * Delete a pairing
 */
api.delete('/pairings/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await c.env.DB.prepare('DELETE FROM pairings WHERE id = ?')
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Pairing not found' }, 404);
    }

    return c.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting pairing:', error);
    return c.json({ success: false, error: 'Failed to delete pairing' }, 500);
  }
});

/**
 * POST /api/submit
 * Saves a new idea to KV storage
 */
api.post('/submit', async (c) => {
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
 * Returns all submitted ideas
 */
api.get('/ideas', async (c) => {
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
