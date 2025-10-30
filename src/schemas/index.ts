/**
 * Zod validation schemas for API endpoints
 *
 * This module defines all validation schemas used across the API.
 * Schemas are used with @hono/zod-openapi for automatic validation
 * and OpenAPI documentation generation.
 *
 * @module schemas
 */

import { z } from 'zod';

/**
 * Common schemas
 */
export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const SlugParamSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

/**
 * Thread schemas
 */
export const CreateThreadSchema = z.object({
  title: z.string().optional(),
  userId: z.string().optional(),
});

export const ThreadResponseSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  title: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number().nullable(),
});

/**
 * Message schemas
 */
export const CreateMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'Content is required'),
});

export const MessageResponseSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  created_at: z.number(),
});

/**
 * Brainstorm chat schemas
 */
export const BrainstormReplySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.record(z.any()).optional(),
});

/**
 * Idea schemas
 */
export const CreateIdeaSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['episode', 'research', 'general']),
  threadId: z.string().optional(),
});

export const IdeaResponseSchema = z.object({
  id: z.string(),
  thread_id: z.string().nullable(),
  content: z.string(),
  type: z.enum(['episode', 'research', 'general']),
  status: z.enum(['pending', 'reviewed', 'approved', 'rejected']),
  created_at: z.number(),
  updated_at: z.number().nullable(),
});

/**
 * Episode schemas
 */
export const CreateEpisodeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

export const UpdateEpisodeSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const EpisodeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number().nullable(),
});

/**
 * Guest profile schemas
 */
export const CreateGuestProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  persona_description: z.string().min(1, 'Persona description is required'),
  expertise: z.string().optional(),
  tone: z.string().optional(),
  background: z.string().optional(),
});

export const UpdateGuestProfileSchema = z.object({
  name: z.string().optional(),
  persona_description: z.string().optional(),
  expertise: z.string().optional(),
  tone: z.string().optional(),
  background: z.string().optional(),
});

export const GuestProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  persona_description: z.string(),
  expertise: z.string().nullable(),
  tone: z.string().nullable(),
  background: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number().nullable(),
});

/**
 * Episode guest schemas
 */
export const AddEpisodeGuestSchema = z.object({
  guestProfileId: z.string().uuid('Invalid guest profile ID'),
});

export const EpisodeGuestResponseSchema = z.object({
  id: z.string(),
  episode_id: z.string(),
  guest_profile_id: z.string(),
  created_at: z.number(),
});

/**
 * Transcript schemas
 */
export const CreateTranscriptSchema = z.object({
  body: z.string().min(1, 'Transcript body is required'),
  format: z.enum(['markdown', 'plain', 'json']).default('markdown'),
});

export const TranscriptResponseSchema = z.object({
  id: z.string(),
  episode_id: z.string(),
  version: z.number(),
  body: z.string(),
  format: z.string(),
  word_count: z.number().nullable(),
  created_at: z.number(),
});

/**
 * Audio version schemas
 */
export const AudioVersionResponseSchema = z.object({
  id: z.string(),
  episode_id: z.string(),
  transcript_id: z.string(),
  version: z.number(),
  r2_key: z.string(),
  r2_url: z.string(),
  duration_seconds: z.number().nullable(),
  file_size_bytes: z.number().nullable(),
  status: z.enum(['generating', 'ready', 'failed']),
  created_at: z.number(),
});

/**
 * Podcast generation schemas
 */
export const GenerateAudioRequestSchema = z.object({
  transcriptId: z.string().uuid().optional(),
  regenerate: z.boolean().default(false),
});

export const GenerateAudioResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  audioVersionId: z.string().optional(),
  status: z.string().optional(),
});

/**
 * Common response wrappers
 */
export const SuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
});

export const ListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    count: z.number(),
  });
