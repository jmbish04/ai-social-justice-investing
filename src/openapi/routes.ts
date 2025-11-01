/**
 * Register API routes with OpenAPI documentation
 * 
 * This module registers all API routes with the OpenAPI registry
 * so they appear in the generated OpenAPI specification.
 */

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { Bindings } from '../types/bindings';
import * as schemas from '../schemas';
import { z } from 'zod';

/**
 * Register all API routes with OpenAPI metadata
 */
export function registerApiRoutes(app: OpenAPIHono<{ Bindings: Bindings }>): void {
  // ============================================
  // THREADS & BRAINSTORM CHAT
  // ============================================

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/threads',
      summary: 'Create a new brainstorm thread',
      description: 'Creates a new brainstorming thread for collaborative ideation',
      request: {
        body: {
          content: {
            'application/json': {
              schema: schemas.CreateThreadSchema,
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Thread created successfully',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.ThreadResponseSchema,
              }),
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: schemas.ErrorResponseSchema,
            },
          },
        },
      },
      tags: ['Threads'],
    }),
    async (c) => {
      // Handler is already implemented in newRoutes.ts
      // This is just for documentation
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/threads/{id}',
      summary: 'Get thread by ID',
      description: 'Retrieves a specific thread by its ID',
      request: {
        params: schemas.IdParamSchema,
      },
      responses: {
        200: {
          description: 'Thread found',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.ThreadResponseSchema,
              }),
            },
          },
        },
        404: {
          description: 'Thread not found',
          content: {
            'application/json': {
              schema: schemas.ErrorResponseSchema,
            },
          },
        },
      },
      tags: ['Threads'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  // ============================================
  // MESSAGES
  // ============================================

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/threads/{id}/messages',
      summary: 'Get thread messages',
      description: 'Retrieves all messages for a specific thread',
      request: {
        params: schemas.IdParamSchema,
      },
      responses: {
        200: {
          description: 'Messages retrieved successfully',
          content: {
            'application/json': {
              schema: schemas.ListResponseSchema(schemas.MessageResponseSchema),
            },
          },
        },
      },
      tags: ['Messages'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  // ============================================
  // BRAINSTORM CHAT
  // ============================================

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/brainstorm/{threadId}/reply',
      summary: 'Send brainstorm message',
      description: 'Sends a message in a brainstorm thread and receives an AI-generated response',
      request: {
        params: z.object({
          threadId: z.string().uuid(),
        }),
        body: {
          content: {
            'application/json': {
              schema: schemas.BrainstormReplySchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'AI response generated',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.MessageResponseSchema,
              }),
            },
          },
        },
        400: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: schemas.ErrorResponseSchema,
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: schemas.ErrorResponseSchema,
            },
          },
        },
      },
      tags: ['Brainstorm'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  // ============================================
  // EPISODES
  // ============================================

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/episodes',
      summary: 'List episodes',
      description: 'Retrieves all episodes, optionally filtered by status',
      request: {
        query: z.object({
          status: z.enum(['planned', 'recorded', 'published']).optional(),
          sort: z.enum(['created_at', 'title']).optional(),
        }),
      },
      responses: {
        200: {
          description: 'Episodes retrieved successfully',
          content: {
            'application/json': {
              schema: schemas.ListResponseSchema(schemas.EpisodeResponseSchema),
            },
          },
        },
      },
      tags: ['Episodes'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/episodes',
      summary: 'Create episode',
      description: 'Creates a new podcast episode',
      request: {
        body: {
          content: {
            'application/json': {
              schema: schemas.CreateEpisodeSchema.extend({
                id: z.string().uuid().optional(),
                status: z.enum(['planned', 'recorded', 'published']).optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Episode created successfully',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.EpisodeResponseSchema,
              }),
            },
          },
        },
      },
      tags: ['Episodes'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/episodes/{id}',
      summary: 'Get episode by ID',
      description: 'Retrieves a specific episode by its ID',
      request: {
        params: schemas.IdParamSchema,
      },
      responses: {
        200: {
          description: 'Episode found',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.EpisodeResponseSchema,
              }),
            },
          },
        },
        404: {
          description: 'Episode not found',
          content: {
            'application/json': {
              schema: schemas.ErrorResponseSchema,
            },
          },
        },
      },
      tags: ['Episodes'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  // ============================================
  // GUEST PROFILES
  // ============================================

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/guest-profiles',
      summary: 'List guest profiles',
      description: 'Retrieves all guest profiles (deduplicated by name)',
      responses: {
        200: {
          description: 'Guest profiles retrieved successfully',
          content: {
            'application/json': {
              schema: schemas.ListResponseSchema(schemas.GuestProfileResponseSchema),
            },
          },
        },
      },
      tags: ['Guest Profiles'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/guest-profiles',
      summary: 'Create guest profile',
      description: 'Creates a new guest profile (or returns existing if duplicate name)',
      request: {
        body: {
          content: {
            'application/json': {
              schema: schemas.CreateGuestProfileSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Guest profile already exists',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.GuestProfileResponseSchema,
                message: z.string().optional(),
              }),
            },
          },
        },
        201: {
          description: 'Guest profile created successfully',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.GuestProfileResponseSchema,
              }),
            },
          },
        },
      },
      tags: ['Guest Profiles'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/guest-profiles/{id}',
      summary: 'Get guest profile by ID',
      description: 'Retrieves a specific guest profile by its ID',
      request: {
        params: schemas.IdParamSchema,
      },
      responses: {
        200: {
          description: 'Guest profile found',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.GuestProfileResponseSchema,
              }),
            },
          },
        },
        404: {
          description: 'Guest profile not found',
          content: {
            'application/json': {
              schema: schemas.ErrorResponseSchema,
            },
          },
        },
      },
      tags: ['Guest Profiles'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  // ============================================
  // TRANSCRIPTS
  // ============================================

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/episodes/{id}/transcripts',
      summary: 'List episode transcripts',
      description: 'Retrieves all transcript versions for an episode',
      request: {
        params: schemas.IdParamSchema,
      },
      responses: {
        200: {
          description: 'Transcripts retrieved successfully',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: z.array(schemas.TranscriptResponseSchema),
              }),
            },
          },
        },
      },
      tags: ['Transcripts'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/episodes/{id}/transcripts',
      summary: 'Create transcript version',
      description: 'Creates a new transcript version for an episode',
      request: {
        params: schemas.IdParamSchema,
        body: {
          content: {
            'application/json': {
              schema: schemas.CreateTranscriptSchema,
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Transcript created successfully',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                data: schemas.TranscriptResponseSchema,
              }),
            },
          },
        },
      },
      tags: ['Transcripts'],
    }),
    async (c) => {
      return c.json({ success: false, error: 'Not implemented in OpenAPI route' }, 501);
    }
  );

  // Add more route registrations as needed...
}

