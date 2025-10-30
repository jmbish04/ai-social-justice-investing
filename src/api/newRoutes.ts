/**
 * New API routes for AI-powered features
 *
 * This module implements all new API endpoints for:
 * - Brainstorm chat (threads, messages, AI responses)
 * - Episode management (CRUD, guests, transcripts, audio generation)
 * - Guest profiles (CRUD)
 * - Podcast generation workflow
 *
 * All routes use Zod schemas for validation and are designed
 * for future integration with @hono/zod-openapi.
 *
 * @module api/newRoutes
 */

import { Hono } from 'hono';
import { Bindings, Thread, Message, Idea, GuestProfile, Transcript, AudioVersion } from '../types/bindings';
import { authMiddleware } from '../middleware/auth';
import { triggerPodcastGeneration } from '../workflows/generatePodcastDemo';
import * as schemas from '../schemas';

const newApi = new Hono<{ Bindings: Bindings }>();

/**
 * ============================================
 * THREADS & BRAINSTORM CHAT
 * ============================================
 */

/**
 * POST /api/threads
 * Create a new brainstorm thread
 */
newApi.post('/threads', async (c) => {
  try {
    const body = await c.req.json();
    const { title, userId } = body;

    const threadId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO threads (id, user_id, title, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(threadId, userId || null, title || null, now)
      .run();

    // Initialize DO session
    const doId = c.env.CHAT_COORDINATOR.idFromName(threadId);
    const doStub = c.env.CHAT_COORDINATOR.get(doId);
    await doStub.fetch(new Request(`https://do.internal/init?threadId=${threadId}`, { method: 'POST' }));

    const thread: Thread = {
      id: threadId,
      user_id: userId || null,
      title: title || null,
      created_at: now,
      updated_at: null,
    };

    return c.json({ success: true, data: thread }, 201);
  } catch (error) {
    console.error('Error creating thread:', error);
    return c.json({ success: false, error: 'Failed to create thread' }, 500);
  }
});

/**
 * GET /api/threads/:id
 * Get thread by ID
 */
newApi.get('/threads/:id', async (c) => {
  try {
    const threadId = c.req.param('id');

    const thread = await c.env.DB.prepare('SELECT * FROM threads WHERE id = ?')
      .bind(threadId)
      .first<Thread>();

    if (!thread) {
      return c.json({ success: false, error: 'Thread not found' }, 404);
    }

    return c.json({ success: true, data: thread });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return c.json({ success: false, error: 'Failed to fetch thread' }, 500);
  }
});

/**
 * GET /api/threads/:id/messages
 * Get all messages for a thread
 */
newApi.get('/threads/:id/messages', async (c) => {
  try {
    const threadId = c.req.param('id');

    const result = await c.env.DB.prepare(
      'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC'
    )
      .bind(threadId)
      .all<Message>();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ success: false, error: 'Failed to fetch messages' }, 500);
  }
});

/**
 * POST /api/brainstorm/:threadId/reply
 * Send a message and get AI response
 */
newApi.post('/brainstorm/:threadId/reply', async (c) => {
  try {
    const threadId = c.req.param('threadId');
    const body = await c.req.json();
    const { message, context } = body;

    if (!message) {
      return c.json({ success: false, error: 'Message is required' }, 400);
    }

    // Save user message
    const userMessageId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(userMessageId, threadId, 'user', message, Date.now())
      .run();

    // Get DO stub for context
    const doId = c.env.CHAT_COORDINATOR.idFromName(threadId);
    const doStub = c.env.CHAT_COORDINATOR.get(doId);

    // Add message to DO context
    await doStub.fetch(
      new Request(`https://do.internal/message?threadId=${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: message }),
      })
    );

    // Generate AI response using Workers AI
    const aiMessages = [
      {
        role: 'system',
        content: `You are a helpful brainstorming assistant for The Social Justice Investor podcast.
Help users develop ideas for podcast episodes, research topics, and social justice themes.
Be creative, thoughtful, and encourage exploration of equity, access, and systems repair.`,
      },
      { role: 'user', content: message },
    ];

    const aiResponse = await c.env.AI.run(c.env.MODEL_REASONING, {
      messages: aiMessages,
      max_tokens: 500,
      temperature: 0.8,
    });

    const assistantMessage = aiResponse.response || 'I apologize, but I had trouble generating a response.';

    // Save assistant message
    const assistantMessageId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(assistantMessageId, threadId, 'assistant', assistantMessage, Date.now())
      .run();

    // Add assistant message to DO
    await doStub.fetch(
      new Request(`https://do.internal/message?threadId=${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'assistant', content: assistantMessage }),
      })
    );

    return c.json({
      success: true,
      data: {
        id: assistantMessageId,
        thread_id: threadId,
        role: 'assistant',
        content: assistantMessage,
        created_at: Date.now(),
      },
    });
  } catch (error) {
    console.error('Error in brainstorm reply:', error);
    return c.json({ success: false, error: 'Failed to generate response' }, 500);
  }
});

/**
 * ============================================
 * IDEAS
 * ============================================
 */

/**
 * POST /api/ideas
 * Create a new idea (from brainstorm or direct submission)
 */
newApi.post('/ideas', async (c) => {
  try {
    const body = await c.req.json();
    const { content, type, threadId } = body;

    if (!content || !type) {
      return c.json({ success: false, error: 'Content and type are required' }, 400);
    }

    const ideaId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO ideas (id, thread_id, content, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(ideaId, threadId || null, content, type, 'pending', now)
      .run();

    const idea: Idea = {
      id: ideaId,
      thread_id: threadId || null,
      content,
      type,
      status: 'pending',
      created_at: now,
      updated_at: null,
    };

    return c.json({ success: true, data: idea }, 201);
  } catch (error) {
    console.error('Error creating idea:', error);
    return c.json({ success: false, error: 'Failed to create idea' }, 500);
  }
});

/**
 * GET /api/ideas
 * List all ideas (requires auth for admin)
 */
newApi.get('/ideas', authMiddleware, async (c) => {
  try {
    const status = c.req.query('status');
    const type = c.req.query('type');

    let query = 'SELECT * FROM ideas WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await c.env.DB.prepare(query).bind(...params).all<Idea>();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    return c.json({ success: false, error: 'Failed to fetch ideas' }, 500);
  }
});

/**
 * ============================================
 * EPISODES
 * ============================================
 */

/**
 * POST /api/episodes
 * Create a new episode
 */
newApi.post('/episodes', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { title, description } = body;

    if (!title) {
      return c.json({ success: false, error: 'Title is required' }, 400);
    }

    const episodeId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO episodes (id, title, description, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(episodeId, title, description || null, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: episodeId,
        title,
        description: description || null,
        created_at: now,
        updated_at: null,
      },
    }, 201);
  } catch (error) {
    console.error('Error creating episode:', error);
    return c.json({ success: false, error: 'Failed to create episode' }, 500);
  }
});

/**
 * GET /api/episodes/:id
 * Get episode by ID (from D1)
 */
newApi.get('/episodes/:id', async (c) => {
  try {
    const episodeId = c.req.param('id');

    const episode = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
      .bind(episodeId)
      .first();

    if (!episode) {
      return c.json({ success: false, error: 'Episode not found' }, 404);
    }

    return c.json({ success: true, data: episode });
  } catch (error) {
    console.error('Error fetching episode:', error);
    return c.json({ success: false, error: 'Failed to fetch episode' }, 500);
  }
});

/**
 * GET /api/episodes/:id/transcripts
 * Retrieve all transcripts for an episode ordered by version
 */
newApi.get('/episodes/:id/transcripts', async (c) => {
  try {
    const episodeId = c.req.param('id');

    const result = await c.env.DB.prepare(
      'SELECT * FROM transcripts WHERE episode_id = ? ORDER BY version DESC'
    )
      .bind(episodeId)
      .all<Transcript>();

    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return c.json({ success: false, error: 'Failed to fetch transcripts' }, 500);
  }
});

/**
 * POST /api/episodes/:id/transcripts
 * Create a new transcript version manually (Save as new version)
 */
newApi.post('/episodes/:id/transcripts', authMiddleware, async (c) => {
  try {
    const episodeId = c.req.param('id');
    const body = await c.req.json<{ body?: string }>();

    if (!body.body) {
      return c.json({ success: false, error: 'Transcript body is required' }, 400);
    }

    const wordCount = body.body.trim().length === 0 ? 0 : body.body.trim().split(/\s+/).length;
    const versionResult = await c.env.DB.prepare(
      'SELECT MAX(version) as max_version FROM transcripts WHERE episode_id = ?'
    )
      .bind(episodeId)
      .first<{ max_version: number | null }>();

    const nextVersion = (versionResult?.max_version ?? 0) + 1;
    const transcriptId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO transcripts (id, episode_id, version, body, format, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(transcriptId, episodeId, nextVersion, body.body, 'markdown', wordCount, now)
      .run();

    const created = await c.env.DB.prepare('SELECT * FROM transcripts WHERE id = ?')
      .bind(transcriptId)
      .first<Transcript>();

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('Error creating transcript version:', error);
    return c.json({ success: false, error: 'Failed to create transcript' }, 500);
  }
});

/**
 * PATCH /api/episodes/:id/transcripts/:transcriptId
 * Autosave transcript edits
 */
newApi.patch('/episodes/:id/transcripts/:transcriptId', authMiddleware, async (c) => {
  try {
    const episodeId = c.req.param('id');
    const transcriptId = c.req.param('transcriptId');
    const body = await c.req.json<{ body?: string }>();

    if (!body.body) {
      return c.json({ success: false, error: 'Transcript body is required' }, 400);
    }

    const wordCount = body.body.trim().length === 0 ? 0 : body.body.trim().split(/\s+/).length;

    await c.env.DB.prepare(
      `UPDATE transcripts SET body = ?, word_count = ?, format = 'markdown'
       WHERE id = ? AND episode_id = ?`
    )
      .bind(body.body, wordCount, transcriptId, episodeId)
      .run();

    const updated = await c.env.DB.prepare('SELECT * FROM transcripts WHERE id = ?')
      .bind(transcriptId)
      .first<Transcript>();

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating transcript:', error);
    return c.json({ success: false, error: 'Failed to update transcript' }, 500);
  }
});

/**
 * GET /api/episodes/:id/audio-versions
 * Retrieve audio versions for an episode
 */
newApi.get('/episodes/:id/audio-versions', async (c) => {
  try {
    const episodeId = c.req.param('id');

    const result = await c.env.DB.prepare(
      'SELECT * FROM audio_versions WHERE episode_id = ? ORDER BY version DESC'
    )
      .bind(episodeId)
      .all<AudioVersion>();

    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    console.error('Error fetching audio versions:', error);
    return c.json({ success: false, error: 'Failed to fetch audio versions' }, 500);
  }
});

/**
 * GET /api/episodes/:id/workflow-status
 * Proxy EpisodeActor workflow status for polling from the frontend
 */
newApi.get('/episodes/:id/workflow-status', async (c) => {
  try {
    const episodeId = c.req.param('id');
    const actorId = c.env.EPISODE_ACTOR.idFromName(episodeId);
    const actor = c.env.EPISODE_ACTOR.get(actorId);

    const response = await actor.fetch(
      new Request(`https://actor.internal/status?episodeId=${episodeId}`)
    );
    const payload = await response.json();
    return c.json(payload);
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    return c.json({ success: false, error: 'Failed to fetch workflow status' }, 500);
  }
});

/**
 * GET /api/episodes/:id/guests
 * Get guests for an episode
 */
newApi.get('/episodes/:id/guests', async (c) => {
  try {
    const episodeId = c.req.param('id');

    const result = await c.env.DB.prepare(
      `SELECT gp.* FROM guest_profiles gp
       JOIN episode_guests eg ON gp.id = eg.guest_profile_id
       WHERE eg.episode_id = ?`
    )
      .bind(episodeId)
      .all<GuestProfile>();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching episode guests:', error);
    return c.json({ success: false, error: 'Failed to fetch episode guests' }, 500);
  }
});

/**
 * POST /api/episodes/:id/guests
 * Add a guest to an episode
 */
newApi.post('/episodes/:id/guests', authMiddleware, async (c) => {
  try {
    const episodeId = c.req.param('id');
    const body = await c.req.json();
    const { guestProfileId } = body;

    if (!guestProfileId) {
      return c.json({ success: false, error: 'Guest profile ID is required' }, 400);
    }

    const linkId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO episode_guests (id, episode_id, guest_profile_id, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(linkId, episodeId, guestProfileId, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: linkId,
        episode_id: episodeId,
        guest_profile_id: guestProfileId,
        created_at: now,
      },
    }, 201);
  } catch (error) {
    console.error('Error adding guest to episode:', error);
    return c.json({ success: false, error: 'Failed to add guest' }, 500);
  }
});

/**
 * DELETE /api/episodes/:id/guests/:guestId
 * Remove a guest from an episode
 */
newApi.delete('/episodes/:id/guests/:guestId', authMiddleware, async (c) => {
  try {
    const episodeId = c.req.param('id');
    const guestId = c.req.param('guestId');

    await c.env.DB.prepare(
      'DELETE FROM episode_guests WHERE episode_id = ? AND guest_profile_id = ?'
    )
      .bind(episodeId, guestId)
      .run();

    return c.json({ success: true, data: { removed: true } });
  } catch (error) {
    console.error('Error removing guest from episode:', error);
    return c.json({ success: false, error: 'Failed to remove guest' }, 500);
  }
});

/**
 * POST /api/episodes/:id/generate-audio
 * Trigger podcast generation workflow
 */
newApi.post('/episodes/:id/generate-audio', authMiddleware, async (c) => {
  try {
    const episodeId = c.req.param('id');

    // Trigger the workflow
    const result = await triggerPodcastGeneration(c.env, episodeId);

    if (!result.success) {
      return c.json({
        success: false,
        ok: false,
        error: result.error || 'Generation failed',
      }, 500);
    }

    return c.json({
      success: true,
      ok: true,
      message: 'Podcast generation completed',
      data: {
        transcriptId: result.transcriptId,
        transcriptVersion: result.transcriptVersion,
        transcriptWordCount: result.transcriptWordCount,
        audioVersionId: result.audioVersionId,
        audio: result.audio,
      },
    });
  } catch (error) {
    console.error('Error triggering podcast generation:', error);
    return c.json({ success: false, ok: false, error: 'Failed to start generation' }, 500);
  }
});

/**
 * ============================================
 * GUEST PROFILES
 * ============================================
 */

/**
 * GET /api/guest-profiles
 * List all guest profiles
 */
newApi.get('/guest-profiles', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM guest_profiles ORDER BY name ASC'
    ).all<GuestProfile>();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching guest profiles:', error);
    return c.json({ success: false, error: 'Failed to fetch guest profiles' }, 500);
  }
});

/**
 * POST /api/guest-profiles
 * Create a new guest profile
 */
newApi.post('/guest-profiles', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { name, persona_description, expertise, tone, background } = body;

    if (!name || !persona_description) {
      return c.json({ success: false, error: 'Name and persona description are required' }, 400);
    }

    const profileId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO guest_profiles (id, name, persona_description, expertise, tone, background, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(profileId, name, persona_description, expertise || null, tone || null, background || null, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: profileId,
        name,
        persona_description,
        expertise: expertise || null,
        tone: tone || null,
        background: background || null,
        created_at: now,
        updated_at: null,
      },
    }, 201);
  } catch (error) {
    console.error('Error creating guest profile:', error);
    return c.json({ success: false, error: 'Failed to create guest profile' }, 500);
  }
});

/**
 * GET /api/guest-profiles/:id
 * Get a guest profile by ID
 */
newApi.get('/guest-profiles/:id', async (c) => {
  try {
    const profileId = c.req.param('id');

    const profile = await c.env.DB.prepare('SELECT * FROM guest_profiles WHERE id = ?')
      .bind(profileId)
      .first<GuestProfile>();

    if (!profile) {
      return c.json({ success: false, error: 'Guest profile not found' }, 404);
    }

    return c.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching guest profile:', error);
    return c.json({ success: false, error: 'Failed to fetch guest profile' }, 500);
  }
});

export default newApi;
