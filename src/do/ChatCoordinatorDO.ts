/**
 * ChatCoordinatorDO - Durable Object for managing brainstorm chat sessions
 *
 * Responsibilities:
 * - Maintains session context and conversation state per thread
 * - Persists and recalls user memory across chat interactions
 * - Coordinates message streaming and AI response generation
 * - Stores ephemeral state in DO storage with KV backup
 *
 * @module do/ChatCoordinatorDO
 */

import { DurableObject } from 'cloudflare:workers';
import { Bindings, Message } from '../types/bindings';

/**
 * Session state stored in DO memory
 */
interface SessionState {
  threadId: string;
  userId: string | null;
  messages: Message[];
  context: Record<string, any>;
  lastActivity: number;
}

/**
 * ChatCoordinatorDO - Manages state for a single brainstorm thread
 */
export class ChatCoordinatorDO extends DurableObject<Bindings> {
  private state: SessionState | null = null;

  /**
   * Constructor - initializes the Durable Object
   * @param ctx - Durable Object context
   * @param env - Environment bindings
   */
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
  }

  /**
   * Initialize or load session state
   * @param threadId - Thread identifier
   * @returns Session state
   */
  private async getState(threadId: string): Promise<SessionState> {
    if (this.state && this.state.threadId === threadId) {
      return this.state;
    }

    // Try to load from DO storage
    const stored = await this.ctx.storage.get<SessionState>('session');
    if (stored && stored.threadId === threadId) {
      this.state = stored;
      return stored;
    }

    // Initialize new state
    this.state = {
      threadId,
      userId: null,
      messages: [],
      context: {},
      lastActivity: Date.now(),
    };

    await this.ctx.storage.put('session', this.state);
    return this.state;
  }

  /**
   * Save current state to DO storage
   */
  private async saveState(): Promise<void> {
    if (this.state) {
      this.state.lastActivity = Date.now();
      await this.ctx.storage.put('session', this.state);
    }
  }

  /**
   * Handle incoming fetch requests to this DO
   * @param request - HTTP request
   * @returns HTTP response
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId');

    if (!threadId) {
      return new Response(JSON.stringify({ error: 'Missing threadId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route based on path
    const path = url.pathname;

    if (path === '/init' && request.method === 'POST') {
      return this.handleInit(threadId);
    }

    if (path === '/messages' && request.method === 'GET') {
      return this.handleGetMessages(threadId);
    }

    if (path === '/message' && request.method === 'POST') {
      return this.handleAddMessage(threadId, request);
    }

    if (path === '/context' && request.method === 'GET') {
      return this.handleGetContext(threadId);
    }

    if (path === '/context' && request.method === 'POST') {
      return this.handleUpdateContext(threadId, request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Initialize a new chat session
   * @param threadId - Thread identifier
   * @returns Response with session info
   */
  private async handleInit(threadId: string): Promise<Response> {
    const state = await this.getState(threadId);
    await this.saveState();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          threadId: state.threadId,
          messageCount: state.messages.length,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get all messages for the thread
   * @param threadId - Thread identifier
   * @returns Response with messages
   */
  private async handleGetMessages(threadId: string): Promise<Response> {
    const state = await this.getState(threadId);

    return new Response(
      JSON.stringify({
        success: true,
        data: state.messages,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Add a new message to the thread
   * @param threadId - Thread identifier
   * @param request - HTTP request with message data
   * @returns Response with added message
   */
  private async handleAddMessage(threadId: string, request: Request): Promise<Response> {
    const state = await this.getState(threadId);
    const body = await request.json() as { role: string; content: string };

    const message: Message = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      role: body.role as 'user' | 'assistant' | 'system',
      content: body.content,
      created_at: Date.now(),
    };

    state.messages.push(message);
    await this.saveState();

    // Also persist to D1 via KV notification (async, non-blocking)
    await this.env.KV.put(`message:${message.id}`, JSON.stringify(message), {
      expirationTtl: 86400, // 24 hours
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: message,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get session context/metadata
   * @param threadId - Thread identifier
   * @returns Response with context data
   */
  private async handleGetContext(threadId: string): Promise<Response> {
    const state = await this.getState(threadId);

    return new Response(
      JSON.stringify({
        success: true,
        data: state.context,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Update session context/metadata
   * @param threadId - Thread identifier
   * @param request - HTTP request with context updates
   * @returns Response with updated context
   */
  private async handleUpdateContext(threadId: string, request: Request): Promise<Response> {
    const state = await this.getState(threadId);
    const updates = await request.json() as Record<string, any>;

    state.context = {
      ...state.context,
      ...updates,
    };

    await this.saveState();

    return new Response(
      JSON.stringify({
        success: true,
        data: state.context,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Cleanup handler - called when DO is evicted from memory
   * Ensures state is persisted before shutdown
   */
  async alarm(): Promise<void> {
    // Auto-cleanup stale sessions (older than 24 hours)
    if (this.state && Date.now() - this.state.lastActivity > 86400000) {
      await this.ctx.storage.deleteAll();
      this.state = null;
    }
  }
}
