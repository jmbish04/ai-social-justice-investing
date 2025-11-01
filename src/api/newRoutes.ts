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
 * GET /api/threads
 * List all threads (for sidebar)
 */
newApi.get('/threads', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const result = await c.env.DB.prepare(
      'SELECT * FROM threads ORDER BY created_at DESC LIMIT ?'
    )
      .bind(limit)
      .all<Thread>();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching threads:', error);
    return c.json({ success: false, error: 'Failed to fetch threads' }, 500);
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
    
    // Get episode title from context if provided
    const episodeTitle = context?.episodeTitle || context?.episodeId || '';

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

    // Get conversation history from DO if available
    const historyResponse = await doStub.fetch(
      new Request(`https://do.internal/history?threadId=${threadId}`, { method: 'GET' })
    ).catch(() => null);
    
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (historyResponse) {
      const historyData = await historyResponse.json().catch(() => null);
      if (historyData?.messages) {
        conversationHistory = historyData.messages;
      }
    }

    // Build messages array with system prompt and conversation history
    // Ensure we have valid messages and filter out any invalid entries
    const conversationMessages = conversationHistory
      .slice(-10) // Last 10 messages for context
      .filter(msg => msg && msg.role && msg.content && typeof msg.content === 'string');

    const aiMessages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: `You are a helpful brainstorming assistant for The Social Justice Investor podcast.
Help users develop ideas for podcast episodes, research topics, and social justice themes.
Be creative, thoughtful, and encourage exploration of equity, access, and systems repair.
When discussing episode "${episodeTitle || 'this episode'}", be specific and relevant to the content.`,
      },
      ...conversationMessages,
      { role: 'user', content: message },
    ];

    // Generate AI response using Workers AI
    let assistantMessage: string;
    try {
      if (!c.env.AI) {
        throw new Error('AI binding is not available');
      }

      // Use the correct model format
      const model = c.env.MODEL_REASONING || '@cf/meta/llama-3.1-8b-instruct';

      console.log('Calling AI with model:', model, 'messages:', aiMessages.length);

      const aiResponse = await c.env.AI.run(model, {
        messages: aiMessages,
        max_tokens: 500,
        temperature: 0.8,
      });

      console.log('AI response received:', typeof aiResponse, aiResponse);

      // Handle response format - can be response.response or directly in response
      assistantMessage = aiResponse?.response ||
                         aiResponse?.text ||
                         (typeof aiResponse === 'string' ? aiResponse : 'I apologize, but I had trouble generating a response.');

      if (!assistantMessage || assistantMessage.trim().length === 0) {
        throw new Error('AI returned empty response');
      }
    } catch (aiError: any) {
      console.error('AI generation error:', aiError);
      const errorMsg = aiError?.message || String(aiError);
      // Provide more helpful error message
      if (errorMsg.includes('oneOf') || errorMsg.includes('required properties')) {
        assistantMessage = `I'm having trouble connecting to the AI service. This might be a temporary issue. Please try again in a moment.`;
      } else {
        assistantMessage = `I encountered an error: ${errorMsg}. Please try again.`;
      }
    }

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
  } catch (error: any) {
    console.error('Error in brainstorm reply:', error);
    const errorMessage = error?.message || 'Failed to generate response';
    return c.json({ 
      success: false, 
      error: errorMessage,
      details: process.env.ENVIRONMENT === 'development' ? String(error) : undefined
    }, 500);
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
 * List all ideas
 */
newApi.get('/ideas', async (c) => {
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
newApi.post('/episodes', async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, description, status } = body;

    if (!title) {
      return c.json({ success: false, error: 'Title is required' }, 400);
    }

    // Use provided ID or generate new one
    const episodeId = id || crypto.randomUUID();
    const now = Date.now();

    // Check if status column exists by trying to insert with it
    try {
      await c.env.DB.prepare(
        'INSERT INTO episodes (id, title, description, status, created_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(episodeId, title, description || null, status || 'planned', now)
        .run();
    } catch (error: any) {
      // If status column doesn't exist, insert without it
      if (error.message?.includes('no such column: status')) {
        await c.env.DB.prepare(
          'INSERT INTO episodes (id, title, description, created_at) VALUES (?, ?, ?, ?)'
        )
          .bind(episodeId, title, description || null, now)
          .run();
      } else {
        throw error;
      }
    }

    return c.json({
      success: true,
      data: {
        id: episodeId,
        title,
        description: description || null,
        status: status || 'planned',
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
newApi.post('/episodes/:id/transcripts', async (c) => {
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
newApi.patch('/episodes/:id/transcripts/:transcriptId', async (c) => {
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
 * Get real-time workflow status for transcript and audio generation
 * Provides comprehensive monitoring data including progress, current step, and results
 */
newApi.get('/episodes/:id/workflow-status', async (c) => {
  try {
    const episodeId = c.req.param('id');
    const actorId = c.env.EPISODE_ACTOR.idFromName(episodeId);
    const actor = c.env.EPISODE_ACTOR.get(actorId);

    const response = await actor.fetch(
      new Request(`https://actor.internal/status?episodeId=${episodeId}`)
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return c.json({ success: false, ...error }, response.status);
    }

    const payload = await response.json();

    // Enhance with additional episode data
    const episode = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
      .bind(episodeId)
      .first();

    // Get latest transcript and audio if available
    const latestTranscript = await c.env.DB.prepare(
      'SELECT * FROM transcripts WHERE episode_id = ? ORDER BY version DESC LIMIT 1'
    )
      .bind(episodeId)
      .first<Transcript>();

    const latestAudio = await c.env.DB.prepare(
      'SELECT * FROM audio_versions WHERE episode_id = ? ORDER BY version DESC LIMIT 1'
    )
      .bind(episodeId)
      .first<any>();

    return c.json({
      success: true,
      workflow: payload,
      episode: episode || null,
      latestTranscript: latestTranscript || null,
      latestAudio: latestAudio ? {
        ...latestAudio,
        status: latestAudio.status,
      } : null,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch workflow status',
      timestamp: Date.now(),
    }, 500);
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
newApi.post('/episodes/:id/guests', async (c) => {
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
newApi.delete('/episodes/:id/guests/:guestId', async (c) => {
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
 * POST /api/episodes/:id/generate-transcript
 * Generate a new transcript version using AI agents (Host + Guests)
 * This creates a conversation-style transcript based on episode metadata
 */
newApi.post('/api/episodes/:id/generate-transcript', async (c) => {
  try {
    const episodeId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { outline, regenerate } = body;

    // Get episode
    const episode = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
      .bind(episodeId)
      .first<any>();

    if (!episode) {
      return c.json({ success: false, error: 'Episode not found' }, 404);
    }

    // Get guests for this episode
    const guestLinks = await c.env.DB.prepare(
      'SELECT guest_profile_id FROM episode_guests WHERE episode_id = ?'
    )
      .bind(episodeId)
      .all<{ guest_profile_id: string }>();

    if (guestLinks.results?.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Episode has no guests assigned. Please add guests before generating transcript.' 
      }, 400);
    }

    // Load guest profiles
    const guestIds = guestLinks.results!.map(g => g.guest_profile_id);
    const placeholders = guestIds.map(() => '?').join(',');
    const guests = await c.env.DB.prepare(
      `SELECT * FROM guest_profiles WHERE id IN (${placeholders})`
    )
      .bind(...guestIds)
      .all<GuestProfile>();

    // Import agents
    const { PodcastBuilderAgent } = await import('../agents/PodcastBuilderAgent');
    const { HostAgent } = await import('../agents/HostAgent');
    const { GuestAgent } = await import('../agents/GuestAgent');

    // Initialize agents
    const hostAgent = new HostAgent(c.env);
    const guestAgents = guests.results!.map(g => new GuestAgent(c.env, g));
    const builder = new PodcastBuilderAgent(c.env, hostAgent, guestAgents);

    // Generate transcript
    const transcriptPackage = await builder.generateTranscriptPackage({
      title: episode.title,
      description: episode.description || '',
    });

    // Save transcript
    const versionResult = await c.env.DB.prepare(
      'SELECT MAX(version) as max_version FROM transcripts WHERE episode_id = ?'
    )
      .bind(episodeId)
      .first<{ max_version: number | null }>();

    const nextVersion = regenerate ? (versionResult?.max_version ?? 1) : ((versionResult?.max_version ?? 0) + 1);
    const transcriptId = crypto.randomUUID();
    const now = Date.now();
    const wordCount = transcriptPackage.wordCount;

    await c.env.DB.prepare(
      `INSERT INTO transcripts (id, episode_id, version, body, format, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(transcriptId, episodeId, nextVersion, transcriptPackage.markdown, 'markdown', wordCount, now)
      .run();

    const savedTranscript = await c.env.DB.prepare('SELECT * FROM transcripts WHERE id = ?')
      .bind(transcriptId)
      .first<Transcript>();

    return c.json({
      success: true,
      message: 'Transcript generated successfully',
      data: {
        transcript: savedTranscript,
        outline: transcriptPackage.outline,
        wordCount,
        segmentCount: transcriptPackage.segments.length,
      },
    }, 201);
  } catch (error) {
    console.error('Error generating transcript:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate transcript' 
    }, 500);
  }
});

/**
 * POST /api/episodes/:id/generate-audio
 * Trigger podcast audio generation workflow with real-time status monitoring
 * Uses EpisodeActor for workflow orchestration and status tracking
 */
newApi.post('/episodes/:id/generate-audio', async (c) => {
  try {
    const episodeId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { transcriptId, transcriptVersion } = body;

    // Verify episode exists
    const episode = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
      .bind(episodeId)
      .first();

    if (!episode) {
      return c.json({ success: false, error: 'Episode not found' }, 404);
    }

    // Get or use latest transcript
    let targetTranscript;
    if (transcriptId) {
      targetTranscript = await c.env.DB.prepare('SELECT * FROM transcripts WHERE id = ? AND episode_id = ?')
        .bind(transcriptId, episodeId)
        .first<Transcript>();
    } else if (transcriptVersion) {
      targetTranscript = await c.env.DB.prepare('SELECT * FROM transcripts WHERE episode_id = ? AND version = ?')
        .bind(episodeId, transcriptVersion)
        .first<Transcript>();
    } else {
      // Get latest transcript
      targetTranscript = await c.env.DB.prepare(
        'SELECT * FROM transcripts WHERE episode_id = ? ORDER BY version DESC LIMIT 1'
      )
        .bind(episodeId)
        .first<Transcript>();
    }

    if (!targetTranscript) {
      return c.json({ 
        success: false, 
        error: 'No transcript found. Please generate a transcript first using POST /api/episodes/:id/generate-transcript' 
      }, 400);
    }

    // Trigger workflow via EpisodeActor for status tracking
    const actorId = c.env.EPISODE_ACTOR.idFromName(episodeId);
    const actor = c.env.EPISODE_ACTOR.get(actorId);

    // Start workflow asynchronously via Actor
    let workflowStatus = { status: 'idle', progress: 0 };
    try {
      const workflowResponse = await actor.fetch(
        new Request(`https://actor.internal/start?episodeId=${episodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcriptId: targetTranscript.id }),
        })
      );
      workflowStatus = await workflowResponse.json().catch(() => ({ status: 'started', progress: 0 }));
    } catch (actorError) {
      console.warn('Actor workflow start failed, continuing with direct workflow:', actorError);
    }

    // Also trigger the synchronous workflow for immediate response
    const result = await triggerPodcastGeneration(c.env, episodeId);

    return c.json({
      success: true,
      ok: result.success,
      message: result.success ? 'Audio generation workflow started' : 'Workflow failed to start',
      data: {
        workflowId: episodeId, // Use episodeId as workflow identifier
        episodeId,
        transcriptId: targetTranscript.id,
        transcriptVersion: targetTranscript.version,
        statusEndpoint: `/api/episodes/${episodeId}/workflow-status`,
        // Include immediate results if available
        ...(result.success && {
          transcriptWordCount: result.transcriptWordCount,
          audioVersionId: result.audioVersionId,
          audio: result.audio,
        }),
      },
      // Include actor status
      workflow: workflowStatus,
    }, result.success ? 200 : 500);
  } catch (error) {
    console.error('Error triggering audio generation:', error);
    return c.json({ 
      success: false, 
      ok: false, 
      error: error instanceof Error ? error.message : 'Failed to start audio generation workflow' 
    }, 500);
  }
});

/**
 * ============================================
 * GUEST PROFILES
 * ============================================
 */

/**
 * GET /api/guest-profiles
 * List all guest profiles (deduplicated by name)
 */
newApi.get('/guest-profiles', async (c) => {
  try {
    // Use DISTINCT to ensure no duplicates based on normalized name
    // Keep the oldest record for each unique name (case-insensitive)
    const result = await c.env.DB.prepare(
      `SELECT gp.* 
       FROM guest_profiles gp
       INNER JOIN (
         SELECT LOWER(TRIM(name)) as normalized_name, MIN(created_at) as min_created_at
         FROM guest_profiles
         GROUP BY LOWER(TRIM(name))
       ) unique_guests
       ON LOWER(TRIM(gp.name)) = unique_guests.normalized_name 
       AND gp.created_at = unique_guests.min_created_at
       ORDER BY gp.name ASC`
    ).all<GuestProfile>();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching guest profiles:', error);
    // Fallback to simple query if the join fails
    try {
      const fallback = await c.env.DB.prepare(
        'SELECT * FROM guest_profiles ORDER BY name ASC'
      ).all<GuestProfile>();
      
      // Deduplicate in memory (keep first occurrence)
      const seen = new Set<string>();
      const deduplicated = (fallback.results || []).filter((profile) => {
        const key = profile.name.trim().toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      return c.json({
        success: true,
        data: deduplicated,
        count: deduplicated.length,
      });
    } catch (fallbackError) {
      return c.json({ success: false, error: 'Failed to fetch guest profiles' }, 500);
    }
  }
});

/**
 * POST /api/guest-profiles
 * Create a new guest profile (or return existing if duplicate name)
 */
newApi.post('/guest-profiles', async (c) => {
  try {
    const body = await c.req.json();
    const { name, persona_description, expertise, tone, background, isBookContributor } = body;

    if (!name || !persona_description) {
      return c.json({ success: false, error: 'Name and persona description are required' }, 400);
    }

    // Check if guest with this name already exists (case-insensitive)
    const normalizedName = name.trim().toLowerCase();
    const existing = await c.env.DB.prepare(
      'SELECT * FROM guest_profiles WHERE LOWER(TRIM(name)) = ?'
    )
      .bind(normalizedName)
      .first<GuestProfile>();

    if (existing) {
      // Return existing guest instead of creating duplicate
      return c.json({
        success: true,
        data: existing,
        message: 'Guest profile already exists with this name',
      }, 200);
    }

    const profileId = crypto.randomUUID();
    const now = Date.now();
    const bookContributor = isBookContributor ? 1 : 0;

    try {
      // Try with is_book_contributor first
      await c.env.DB.prepare(
        `INSERT INTO guest_profiles (id, name, persona_description, expertise, tone, background, is_book_contributor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(profileId, name.trim(), persona_description, expertise || null, tone || null, background || null, bookContributor, now)
        .run();
    } catch (insertError: any) {
      // If column doesn't exist yet (migration not run), fall back to old schema
      if (insertError?.message?.includes('no such column: is_book_contributor')) {
        await c.env.DB.prepare(
          `INSERT INTO guest_profiles (id, name, persona_description, expertise, tone, background, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(profileId, name.trim(), persona_description, expertise || null, tone || null, background || null, now)
          .run();
      } else if (insertError?.message?.includes('UNIQUE') || insertError?.message?.includes('unique')) {
        // If insert fails due to unique constraint, try to fetch existing
        const existingAfterError = await c.env.DB.prepare(
          'SELECT * FROM guest_profiles WHERE LOWER(TRIM(name)) = ?'
        )
          .bind(normalizedName)
          .first<GuestProfile>();

        if (existingAfterError) {
          return c.json({
            success: true,
            data: existingAfterError,
            message: 'Guest profile already exists with this name',
          }, 200);
        }
      } else {
        throw insertError;
      }
    }

    const created = await c.env.DB.prepare('SELECT * FROM guest_profiles WHERE id = ?')
      .bind(profileId)
      .first<GuestProfile>();

    return c.json({
      success: true,
      data: created,
    }, 201);
  } catch (error: any) {
    console.error('Error creating guest profile:', error);
    return c.json({
      success: false,
      error: error?.message || 'Failed to create guest profile'
    }, 500);
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
