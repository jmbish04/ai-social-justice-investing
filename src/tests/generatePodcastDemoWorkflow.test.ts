/**
 * Integration-oriented tests for the GeneratePodcastDemoWorkflow orchestration.
 *
 * These tests validate transcript versioning, audio metadata persistence, and
 * error handling by exercising the workflow against an in-memory D1 mock.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings, Episode } from '../types/bindings';
import { GeneratePodcastDemoWorkflow } from '../workflows/generatePodcastDemo';
import { PodcastBuilderAgent } from '../agents/PodcastBuilderAgent';

const generateTranscriptPackageMock = vi.fn<
  () => Promise<{
    text: string;
    outline: {
      title: string;
      introduction: string;
      segments: Array<{ topic: string; keyPoints: string[]; estimatedTurns: number }>;
      conclusion: string;
    };
    segments: Array<{ speaker: string; content: string }>;
    wordCount: number;
  }>
>();

const createForEpisodeMock = vi.fn<
  (env: Bindings, episodeId: string) => Promise<any>
>();

const generateAndUploadAudioMock = vi.fn<
  (
    episodeId: string,
    version: number,
    segments: Array<{ speaker: string; text: string }>
  ) => Promise<{ r2Key: string; r2Url: string; durationSeconds: number; fileSizeBytes: number }>
>();

vi.mock('../agents/PodcastBuilderAgent', () => {
  class MockPodcastBuilderAgent {
    async generateTranscriptPackage() {
      return generateTranscriptPackageMock();
    }

    static async createForEpisode(env: Bindings, episodeId: string) {
      return createForEpisodeMock(env, episodeId);
    }
  }

  return { PodcastBuilderAgent: MockPodcastBuilderAgent };
});

vi.mock('../agents/AudioDirectorAgent', () => {
  class MockAudioDirectorAgent {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_env: Bindings) {}

    async generateAndUploadAudio(
      episodeId: string,
      version: number,
      segments: Array<{ speaker: string; text: string }>
    ) {
      return generateAndUploadAudioMock(episodeId, version, segments);
    }
  }

  return { AudioDirectorAgent: MockAudioDirectorAgent };
});

interface MockTranscriptRow {
  id: string;
  episode_id: string;
  version: number;
  body: string;
  format: string;
  word_count: number;
  created_at: number;
}

interface MockAudioVersionRow {
  id: string;
  episode_id: string;
  transcript_id: string;
  version: number;
  r2_key: string;
  r2_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  status: string;
  created_at: number;
}

/**
 * Create an in-memory D1 mock tailored for the workflow tests.
 * @param episodes - Seed episode records available to the workflow
 * @returns Database mock plus captured transcript/audio rows
 */
function createMockD1Database(episodes: Episode[]) {
  const episodeMap = new Map<string, Episode>();
  for (const episode of episodes) {
    episodeMap.set(episode.id, episode);
  }

  const transcripts: MockTranscriptRow[] = [];
  const audioVersions: MockAudioVersionRow[] = [];

  const db: D1Database = {
    prepare(statement: string) {
      let bound: unknown[] = [];

      const prepared = {
        bind(...args: unknown[]) {
          bound = args;
          return prepared;
        },
        async first<T>() {
          if (statement.includes('SELECT * FROM episodes WHERE id = ?')) {
            const episodeId = bound[0] as string;
            return (episodeMap.get(episodeId) ?? null) as T | null;
          }

          if (statement.includes('SELECT MAX(version) as max_version FROM transcripts WHERE episode_id = ?')) {
            const episodeId = bound[0] as string;
            const versions = transcripts.filter(row => row.episode_id === episodeId).map(row => row.version);
            const maxVersion = versions.length > 0 ? Math.max(...versions) : null;
            return { max_version: maxVersion } as T;
          }

          return null;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async run() {
          if (statement.includes('INSERT INTO transcripts')) {
            const [
              id,
              episodeId,
              version,
              body,
              format,
              wordCount,
              createdAt,
            ] = bound as [string, string, number, string, string, number, number];

            transcripts.push({
              id,
              episode_id: episodeId,
              version,
              body,
              format,
              word_count: wordCount,
              created_at: createdAt,
            });
            return { success: true };
          }

          if (statement.includes('INSERT INTO audio_versions')) {
            const [
              id,
              episodeId,
              transcriptId,
              version,
              r2Key,
              r2Url,
              durationSeconds,
              fileSizeBytes,
              status,
              createdAt,
            ] = bound as [
              string,
              string,
              string,
              number,
              string,
              string,
              number,
              number,
              string,
              number,
            ];

            audioVersions.push({
              id,
              episode_id: episodeId,
              transcript_id: transcriptId,
              version,
              r2_key: r2Key,
              r2_url: r2Url,
              duration_seconds: durationSeconds,
              file_size_bytes: fileSizeBytes,
              status,
              created_at: createdAt,
            });
            return { success: true };
          }

          return { success: false };
        },
      } satisfies Partial<D1PreparedStatement> & {
        bind: (...args: unknown[]) => typeof prepared;
      };

      return prepared as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;

  const dbWithState = db as unknown as {
    transcripts?: MockTranscriptRow[];
    audioVersions?: MockAudioVersionRow[];
  };
  dbWithState.transcripts = transcripts;
  dbWithState.audioVersions = audioVersions;

  return { db, transcripts, audioVersions };
}

/**
 * Construct a minimal Bindings object for exercising the workflow in tests.
 * @param db - Mock D1 database instance
 * @returns Partial Bindings with only required fields populated
 */
function createTestBindings(db: D1Database): Bindings {
  return {
    DB: db,
    BUCKET: {} as unknown as R2Bucket,
    KV: {} as unknown as KVNamespace,
    IDEAS_KV: {} as unknown as KVNamespace,
    RESEARCH_KV: {} as unknown as KVNamespace,
    CHAT_COORDINATOR: {} as unknown as DurableObjectNamespace,
    EPISODE_ACTOR: {} as unknown as DurableObjectNamespace,
    AI: {} as unknown as Ai,
    ADMIN_TOKEN: 'test-token',
    ENVIRONMENT: 'test',
    R2_PUBLIC_URL: 'https://r2.example.com',
    MODEL_REASONING: '@test/model',
    MODEL_STT: '@test/stt',
  };
}

describe('GeneratePodcastDemoWorkflow', () => {
  const baseEpisode: Episode = {
    id: 'episode-1',
    title: 'Justice for All',
    description: 'Exploring equitable investing strategies.',
    guest: 'Test Guest',
    status: 'planned',
  };

  beforeEach(() => {
    generateTranscriptPackageMock.mockReset();
    createForEpisodeMock.mockReset();
    generateAndUploadAudioMock.mockReset();

    generateTranscriptPackageMock.mockResolvedValue({
      text: 'Host: Welcome to the show.',
      outline: {
        title: 'Justice for All',
        introduction: 'An overview of equitable finance.',
        segments: [
          {
            topic: 'Foundations',
            keyPoints: ['Impact investing', 'Community wealth'],
            estimatedTurns: 6,
          },
        ],
        conclusion: 'Key takeaways and actions.',
      },
      segments: [
        { speaker: 'Host', content: 'Welcome to the show.' },
        { speaker: 'Guest', content: 'Thank you for having me.' },
      ],
      wordCount: 12,
    });

    createForEpisodeMock.mockImplementation(async () => new (PodcastBuilderAgent as unknown as { new (): any })());

    generateAndUploadAudioMock.mockResolvedValue({
      r2Key: 'podcasts/episode-1/v1.mp3',
      r2Url: 'https://r2.example.com/podcasts/episode-1/v1.mp3',
      durationSeconds: 180,
      fileSizeBytes: 1024,
    });
  });

  it('persists transcript and audio versions when generation succeeds', async () => {
    const { db, transcripts, audioVersions } = createMockD1Database([baseEpisode]);
    const env = createTestBindings(db);
    const workflow = new GeneratePodcastDemoWorkflow(env);

    const result = await workflow.run(baseEpisode.id);

    expect(result.success).toBe(true);
    expect(result.transcriptVersion).toBe(1);
    expect(transcripts).toHaveLength(1);
    expect(audioVersions).toHaveLength(1);
    expect(createForEpisodeMock).toHaveBeenCalledWith(env, baseEpisode.id);
    expect(generateTranscriptPackageMock).toHaveBeenCalledTimes(1);
    expect(generateAndUploadAudioMock).toHaveBeenCalledWith(
      baseEpisode.id,
      1,
      expect.arrayContaining([
        expect.objectContaining({ speaker: 'Host' }),
        expect.objectContaining({ speaker: 'Guest' }),
      ])
    );
  });

  it('returns a failure result when the episode cannot be located', async () => {
    const { db } = createMockD1Database([]);
    const env = createTestBindings(db);
    const workflow = new GeneratePodcastDemoWorkflow(env);

    const result = await workflow.run('missing-episode');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Episode not found');
    expect(createForEpisodeMock).not.toHaveBeenCalled();
  });

  it('surfaces an error when guest agents cannot be created', async () => {
    const { db, transcripts, audioVersions } = createMockD1Database([baseEpisode]);
    const env = createTestBindings(db);
    const workflow = new GeneratePodcastDemoWorkflow(env);

    createForEpisodeMock.mockResolvedValueOnce(null);

    const result = await workflow.run(baseEpisode.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No guests assigned');
    expect(transcripts).toHaveLength(0);
    expect(audioVersions).toHaveLength(0);
  });
});
