/**
 * GeneratePodcastDemoWorkflow - Multi-step podcast generation pipeline
 *
 * This workflow orchestrates the complete podcast generation process:
 * 1. Fetch episode and guest information from D1
 * 2. Instantiate Host and Guest agents
 * 3. Generate transcript using PodcastBuilderAgent
 * 4. Save transcript to D1
 * 5. Generate audio using AudioDirectorAgent
 * 6. Upload audio to R2
 * 7. Save audio metadata to D1
 *
 * Uses EpisodeActor to serialize operations and prevent race conditions.
 *
 * @module workflows/generatePodcastDemo
 */

import { Bindings, Episode } from '../types/bindings';
import { PodcastBuilderAgent } from '../agents/PodcastBuilderAgent';
import { AudioDirectorAgent } from '../agents/AudioDirectorAgent';

/**
 * Workflow execution result structure
 */
export interface PodcastGenerationResult {
  success: boolean;
  ok?: boolean;
  transcriptId?: string;
  transcriptVersion?: number;
  transcriptWordCount?: number;
  audioVersionId?: string;
  audio?: {
    r2Key: string;
    r2Url: string;
    durationSeconds: number;
    fileSizeBytes: number;
  };
  error?: string;
}

/**
 * Progress callback function type used for reporting workflow status to actors/UI
 */
type ProgressCallback = (step: string, progress: number) => Promise<void>;

/**
 * GeneratePodcastDemoWorkflow encapsulates the orchestration logic for creating demo podcasts.
 */
export class GeneratePodcastDemoWorkflow {
  private progressCallback?: ProgressCallback;

  /**
   * Create a new workflow instance.
   * @param env - Cloudflare Worker environment bindings
   */
  constructor(private readonly env: Bindings) {}

  /**
   * Execute the workflow for a given episode.
   * @param episodeId - Identifier of the episode to process
   * @param progressCallback - Optional callback for progress updates
   * @returns Detailed workflow result including transcript/audio identifiers
   */
  async run(episodeId: string, progressCallback?: ProgressCallback): Promise<PodcastGenerationResult> {
    this.progressCallback = progressCallback;

    try {
      await this.updateProgress('Fetching episode data', 10);
      const episode = await this.fetchEpisode(episodeId);
      if (!episode) {
        throw new Error(`Episode not found: ${episodeId}`);
      }

      await this.updateProgress('Loading guest profiles', 20);
      const builder = await PodcastBuilderAgent.createForEpisode(this.env, episodeId);
      if (!builder) {
        throw new Error('No guests assigned to this episode');
      }

      await this.updateProgress('Generating transcript content', 40);
      const transcriptPackage = await builder.generateTranscriptPackage({
        title: episode.title,
        description: episode.description ?? '',
      });

      await this.updateProgress('Calculating transcript version', 55);
      const transcriptVersion = await this.getNextTranscriptVersion(episodeId);

      await this.updateProgress('Saving transcript to database', 65);
      const transcriptId = await this.insertTranscript(
        episodeId,
        transcriptVersion,
        transcriptPackage.text,
        transcriptPackage.wordCount
      );

      await this.updateProgress('Generating audio placeholder', 75);
      const audioDirector = new AudioDirectorAgent(this.env);
      const audioResult = await audioDirector.generateAndUploadAudio(
        episodeId,
        transcriptVersion,
        transcriptPackage.segments.map(segment => ({
          speaker: segment.speaker,
          text: segment.content,
        }))
      );

      await this.updateProgress('Saving audio metadata', 90);
      const audioVersionId = await this.insertAudioVersion(
        episodeId,
        transcriptId,
        transcriptVersion,
        audioResult
      );

      await this.updateProgress('Podcast generation completed', 100);

      return {
        success: true,
        ok: true,
        transcriptId,
        transcriptVersion,
        transcriptWordCount: transcriptPackage.wordCount,
        audioVersionId,
        audio: {
          r2Key: audioResult.r2Key,
          r2Url: audioResult.r2Url,
          durationSeconds: audioResult.durationSeconds,
          fileSizeBytes: audioResult.fileSizeBytes,
        },
      };
    } catch (error) {
      console.error('Podcast generation workflow error:', error);
      return {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.progressCallback = undefined;
    }
  }

  /**
   * Fetch episode data from D1.
   * @param episodeId - Episode identifier
   * @returns Episode record or null
   */
  private async fetchEpisode(episodeId: string): Promise<Episode | null> {
    try {
      const result = await this.env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
        .bind(episodeId)
        .first<Episode>();

      return result ?? null;
    } catch (error) {
      console.error('Error fetching episode:', error);
      return null;
    }
  }

  /**
   * Compute the next transcript version for an episode.
   * @param episodeId - Episode identifier
   * @returns Incremented version number
   */
  private async getNextTranscriptVersion(episodeId: string): Promise<number> {
    const versionResult = await this.env.DB.prepare(
      'SELECT MAX(version) as max_version FROM transcripts WHERE episode_id = ?'
    )
      .bind(episodeId)
      .first<{ max_version: number | null }>();

    return (versionResult?.max_version ?? 0) + 1;
  }

  /**
   * Insert transcript metadata into D1.
   * @param episodeId - Episode identifier
   * @param version - Transcript version number
   * @param body - Markdown transcript content
   * @param wordCount - Calculated word count
   * @returns Newly created transcript ID
   */
  private async insertTranscript(
    episodeId: string,
    version: number,
    body: string,
    wordCount: number
  ): Promise<string> {
    const transcriptId = crypto.randomUUID();

    await this.env.DB.prepare(
      `INSERT INTO transcripts (id, episode_id, version, body, format, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(transcriptId, episodeId, version, body, 'markdown', wordCount, Date.now())
      .run();

    return transcriptId;
  }

  /**
   * Insert audio metadata into D1.
   * @param episodeId - Episode identifier
   * @param transcriptId - Associated transcript ID
   * @param version - Version number shared with transcript
   * @param audioResult - Uploaded audio metadata
   * @returns Newly created audio version ID
   */
  private async insertAudioVersion(
    episodeId: string,
    transcriptId: string,
    version: number,
    audioResult: {
      r2Key: string;
      r2Url: string;
      durationSeconds: number;
      fileSizeBytes: number;
    }
  ): Promise<string> {
    const audioVersionId = crypto.randomUUID();

    await this.env.DB.prepare(
      `INSERT INTO audio_versions
       (id, episode_id, transcript_id, version, r2_key, r2_url, duration_seconds, file_size_bytes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        audioVersionId,
        episodeId,
        transcriptId,
        version,
        audioResult.r2Key,
        audioResult.r2Url,
        audioResult.durationSeconds,
        audioResult.fileSizeBytes,
        'ready',
        Date.now()
      )
      .run();

    return audioVersionId;
  }

  /**
   * Notify listeners of workflow progress.
   * @param step - Human-readable step description
   * @param progress - Progress percentage (0-100)
   */
  private async updateProgress(step: string, progress: number): Promise<void> {
    if (!this.progressCallback) {
      return;
    }

    try {
      await this.progressCallback(step, progress);
    } catch (error) {
      console.error('Progress callback error:', error);
    }
  }
}

/**
 * Trigger workflow via EpisodeActor.
 * This helper coordinates Durable Object state with workflow execution.
 *
 * @param env - Environment bindings
 * @param episodeId - Episode ID
 * @returns Workflow execution result
 */
export async function triggerPodcastGeneration(
  env: Bindings,
  episodeId: string
): Promise<PodcastGenerationResult> {
  const actorId = env.EPISODE_ACTOR.idFromName(episodeId);
  const actor = env.EPISODE_ACTOR.get(actorId);

  const statusResponse = await actor.fetch(
    new Request(`https://actor.internal/status?episodeId=${episodeId}`)
  );
  const statusData = await statusResponse.json() as { success: boolean; data: { status: string } };

  if (
    statusData.data.status !== 'idle' &&
    statusData.data.status !== 'completed' &&
    statusData.data.status !== 'failed'
  ) {
    return {
      success: false,
      ok: false,
      error: 'Podcast generation already in progress for this episode',
    };
  }

  await actor.fetch(
    new Request(`https://actor.internal/start?episodeId=${episodeId}`, {
      method: 'POST',
    })
  );

  const workflow = new GeneratePodcastDemoWorkflow(env);
  const progressCallback: ProgressCallback = async (step, progress) => {
    await actor.fetch(
      new Request(`https://actor.internal/update?episodeId=${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: step, progress }),
      })
    );
  };

  const result = await workflow.run(episodeId, progressCallback);

  if (result.success) {
    await actor.fetch(
      new Request(`https://actor.internal/complete?episodeId=${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptId: result.transcriptId,
          transcriptVersion: result.transcriptVersion,
          audioVersionId: result.audioVersionId,
          audio: result.audio,
        }),
      })
    );
  } else {
    await actor.fetch(
      new Request(`https://actor.internal/fail?episodeId=${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: result.error || 'Unknown error' }),
      })
    );
  }

  return result;
}
