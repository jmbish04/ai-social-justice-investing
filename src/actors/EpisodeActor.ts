/**
 * EpisodeActor - Durable Object for serializing episode workflows
 *
 * This Actor ensures that only one workflow runs per episode at a time,
 * preventing race conditions during podcast generation. It acts as a
 * coordinator for long-running operations like transcript generation
 * and audio synthesis.
 *
 * @module actors/EpisodeActor
 */

import { DurableObject } from 'cloudflare:workers';
import { Bindings } from '../types/bindings';

/**
 * Workflow status
 */
type WorkflowStatus = 'idle' | 'generating_transcript' | 'generating_audio' | 'completed' | 'failed';

/**
 * Episode workflow state
 */
interface EpisodeWorkflowState {
  episodeId: string;
  status: WorkflowStatus;
  currentStep: string | null;
  progress: number; // 0-100
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  result: {
    transcriptId?: string;
    transcriptVersion?: number;
    audioVersionId?: string;
    audio?: {
      r2Key?: string;
      r2Url?: string;
      durationSeconds?: number;
      fileSizeBytes?: number;
    };
  } | null;
}

/**
 * EpisodeActor - Serializes workflows for a single episode
 */
export class EpisodeActor extends DurableObject<Bindings> {
  private state: EpisodeWorkflowState | null = null;

  /**
   * Constructor - initializes the Durable Object
   * @param ctx - Durable Object context
   * @param env - Environment bindings
   */
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
  }

  /**
   * Load or initialize workflow state
   * @param episodeId - Episode identifier
   * @returns Workflow state
   */
  private async getState(episodeId: string): Promise<EpisodeWorkflowState> {
    if (this.state && this.state.episodeId === episodeId) {
      return this.state;
    }

    // Try to load from storage
    const stored = await this.ctx.storage.get<EpisodeWorkflowState>('workflow');
    if (stored && stored.episodeId === episodeId) {
      this.state = stored;
      return stored;
    }

    // Initialize new state
    this.state = {
      episodeId,
      status: 'idle',
      currentStep: null,
      progress: 0,
      startedAt: null,
      completedAt: null,
      error: null,
      result: null,
    };

    await this.ctx.storage.put('workflow', this.state);
    return this.state;
  }

  /**
   * Save current state to storage
   */
  private async saveState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put('workflow', this.state);
    }
  }

  /**
   * Handle incoming fetch requests
   * @param request - HTTP request
   * @returns HTTP response
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const episodeId = url.searchParams.get('episodeId');

    if (!episodeId) {
      return new Response(JSON.stringify({ error: 'Missing episodeId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const path = url.pathname;

    if (path === '/status' && request.method === 'GET') {
      return this.handleGetStatus(episodeId);
    }

    if (path === '/start' && request.method === 'POST') {
      return this.handleStartWorkflow(episodeId, request);
    }

    if (path === '/update' && request.method === 'POST') {
      return this.handleUpdateProgress(episodeId, request);
    }

    if (path === '/complete' && request.method === 'POST') {
      return this.handleComplete(episodeId, request);
    }

    if (path === '/fail' && request.method === 'POST') {
      return this.handleFail(episodeId, request);
    }

    if (path === '/reset' && request.method === 'POST') {
      return this.handleReset(episodeId);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Get current workflow status
   * @param episodeId - Episode identifier
   * @returns Response with status
   */
  private async handleGetStatus(episodeId: string): Promise<Response> {
    const state = await this.getState(episodeId);

    return new Response(
      JSON.stringify({
        success: true,
        data: state,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Start a new workflow
   * @param episodeId - Episode identifier
   * @param request - HTTP request
   * @returns Response with workflow status
   */
  private async handleStartWorkflow(episodeId: string, request: Request): Promise<Response> {
    const state = await this.getState(episodeId);

    // Check if already running
    if (state.status !== 'idle' && state.status !== 'completed' && state.status !== 'failed') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Workflow already in progress',
          data: state,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Start new workflow
    state.status = 'generating_transcript';
    state.currentStep = 'Initializing podcast generation';
    state.progress = 0;
    state.startedAt = Date.now();
    state.completedAt = null;
    state.error = null;
    state.result = null;

    await this.saveState();

    return new Response(
      JSON.stringify({
        success: true,
        data: state,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Update workflow progress
   * @param episodeId - Episode identifier
   * @param request - HTTP request with progress update
   * @returns Response with updated status
   */
  private async handleUpdateProgress(episodeId: string, request: Request): Promise<Response> {
    const state = await this.getState(episodeId);
    const body = await request.json() as {
      status?: WorkflowStatus;
      currentStep?: string;
      progress?: number;
    };

    if (body.status) state.status = body.status;
    if (body.currentStep) state.currentStep = body.currentStep;
    if (body.progress !== undefined) state.progress = body.progress;

    await this.saveState();

    return new Response(
      JSON.stringify({
        success: true,
        data: state,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Mark workflow as completed
   * @param episodeId - Episode identifier
   * @param request - HTTP request with completion data
   * @returns Response with final status
   */
  private async handleComplete(episodeId: string, request: Request): Promise<Response> {
    const state = await this.getState(episodeId);
    const body = await request.json() as {
      transcriptId?: string;
      transcriptVersion?: number;
      audioVersionId?: string;
      audio?: {
        r2Key?: string;
        r2Url?: string;
        durationSeconds?: number;
        fileSizeBytes?: number;
      };
    };

    state.status = 'completed';
    state.currentStep = 'Workflow completed successfully';
    state.progress = 100;
    state.completedAt = Date.now();
    state.result = {
      transcriptId: body.transcriptId,
      transcriptVersion: body.transcriptVersion,
      audioVersionId: body.audioVersionId,
      audio: body.audio,
    };

    await this.saveState();

    return new Response(
      JSON.stringify({
        success: true,
        data: state,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Mark workflow as failed
   * @param episodeId - Episode identifier
   * @param request - HTTP request with error information
   * @returns Response with error status
   */
  private async handleFail(episodeId: string, request: Request): Promise<Response> {
    const state = await this.getState(episodeId);
    const body = await request.json() as { error: string };

    state.status = 'failed';
    state.error = body.error;
    state.completedAt = Date.now();

    await this.saveState();

    return new Response(
      JSON.stringify({
        success: false,
        data: state,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Reset workflow state
   * @param episodeId - Episode identifier
   * @returns Response with reset confirmation
   */
  private async handleReset(episodeId: string): Promise<Response> {
    const state = await this.getState(episodeId);

    state.status = 'idle';
    state.currentStep = null;
    state.progress = 0;
    state.startedAt = null;
    state.completedAt = null;
    state.error = null;
    state.result = null;

    await this.saveState();

    return new Response(
      JSON.stringify({
        success: true,
        data: state,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Cleanup handler for automatic state management
   */
  async alarm(): Promise<void> {
    // Auto-reset stale workflows (older than 1 hour)
    if (this.state && this.state.startedAt) {
      const ageMs = Date.now() - this.state.startedAt;
      if (ageMs > 3600000 && this.state.status !== 'completed') {
        this.state.status = 'failed';
        this.state.error = 'Workflow timeout (exceeded 1 hour)';
        await this.saveState();
      }
    }
  }
}
