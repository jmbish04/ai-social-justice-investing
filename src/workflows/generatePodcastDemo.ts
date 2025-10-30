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

import { Bindings, Episode, Transcript, AudioVersion } from '../types/bindings';
import { HostAgent } from '../agents/HostAgent';
import { GuestAgent } from '../agents/GuestAgent';
import { PodcastBuilderAgent } from '../agents/PodcastBuilderAgent';
import { AudioDirectorAgent } from '../agents/AudioDirectorAgent';

/**
 * Workflow result
 */
export interface PodcastGenerationResult {
  success: boolean;
  transcriptId?: string;
  audioVersionId?: string;
  error?: string;
}

/**
 * Progress callback function type
 */
type ProgressCallback = (step: string, progress: number) => Promise<void>;

/**
 * Main workflow function to generate a complete podcast demo
 *
 * @param env - Cloudflare Worker environment bindings
 * @param episodeId - ID of the episode to generate
 * @param progressCallback - Optional callback for progress updates
 * @returns Generation result with IDs
 */
export async function generatePodcastDemoWorkflow(
  env: Bindings,
  episodeId: string,
  progressCallback?: ProgressCallback
): Promise<PodcastGenerationResult> {
  try {
    // Step 1: Fetch episode from D1
    await updateProgress(progressCallback, 'Fetching episode data', 10);

    const episode = await fetchEpisode(env, episodeId);
    if (!episode) {
      throw new Error(`Episode not found: ${episodeId}`);
    }

    // Step 2: Fetch guest profiles
    await updateProgress(progressCallback, 'Loading guest profiles', 20);

    const guestLinks = await env.DB.prepare(
      'SELECT guest_profile_id FROM episode_guests WHERE episode_id = ?'
    )
      .bind(episodeId)
      .all<{ guest_profile_id: string }>();

    if (!guestLinks.results || guestLinks.results.length === 0) {
      throw new Error('No guests assigned to this episode');
    }

    // Step 3: Instantiate agents
    await updateProgress(progressCallback, 'Initializing AI agents', 30);

    const hostAgent = new HostAgent(env);
    const guestAgents: GuestAgent[] = [];

    for (const link of guestLinks.results) {
      const guest = await GuestAgent.loadFromDatabase(env, link.guest_profile_id);
      if (guest) {
        guestAgents.push(guest);
      }
    }

    if (guestAgents.length === 0) {
      throw new Error('Failed to load guest agents');
    }

    // Step 4: Create PodcastBuilderAgent
    await updateProgress(progressCallback, 'Creating podcast builder', 35);

    const builder = new PodcastBuilderAgent(env, hostAgent, guestAgents);

    // Step 5: Generate transcript
    await updateProgress(progressCallback, 'Generating transcript (this may take a few minutes)', 40);

    const transcriptMarkdown = await builder.generateTranscript({
      title: episode.title,
      description: episode.description,
    });

    // Step 6: Calculate next version number
    await updateProgress(progressCallback, 'Saving transcript to database', 60);

    const versionResult = await env.DB.prepare(
      'SELECT MAX(version) as max_version FROM transcripts WHERE episode_id = ?'
    )
      .bind(episodeId)
      .first<{ max_version: number | null }>();

    const nextVersion = (versionResult?.max_version || 0) + 1;

    // Step 7: Save transcript to D1
    const transcriptId = crypto.randomUUID();
    const wordCount = builder.getWordCount();

    await env.DB.prepare(
      `INSERT INTO transcripts (id, episode_id, version, body, format, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(transcriptId, episodeId, nextVersion, transcriptMarkdown, 'markdown', wordCount, Date.now())
      .run();

    // Step 8: Generate audio
    await updateProgress(progressCallback, 'Generating audio file (stub implementation)', 70);

    const audioDirector = new AudioDirectorAgent(env);
    const segments = builder.getTranscriptSegments().map(seg => ({
      speaker: seg.speaker,
      text: seg.content,
    }));

    const audioResult = await audioDirector.generateAndUploadAudio(episodeId, nextVersion, segments);

    // Step 9: Save audio metadata to D1
    await updateProgress(progressCallback, 'Saving audio metadata', 90);

    const audioVersionId = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO audio_versions
       (id, episode_id, transcript_id, version, r2_key, r2_url, duration_seconds, file_size_bytes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        audioVersionId,
        episodeId,
        transcriptId,
        nextVersion,
        audioResult.r2Key,
        audioResult.r2Url,
        audioResult.durationSeconds,
        audioResult.fileSizeBytes,
        'ready',
        Date.now()
      )
      .run();

    // Step 10: Complete
    await updateProgress(progressCallback, 'Podcast generation completed', 100);

    return {
      success: true,
      transcriptId,
      audioVersionId,
    };
  } catch (error) {
    console.error('Podcast generation workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch episode from database
 * @param env - Environment bindings
 * @param episodeId - Episode ID
 * @returns Episode or null
 */
async function fetchEpisode(env: Bindings, episodeId: string): Promise<Episode | null> {
  try {
    const result = await env.DB.prepare('SELECT * FROM episodes WHERE id = ?')
      .bind(episodeId)
      .first<Episode>();

    return result;
  } catch (error) {
    console.error('Error fetching episode:', error);
    return null;
  }
}

/**
 * Update progress via callback
 * @param callback - Progress callback function
 * @param step - Current step description
 * @param progress - Progress percentage (0-100)
 */
async function updateProgress(
  callback: ProgressCallback | undefined,
  step: string,
  progress: number
): Promise<void> {
  if (callback) {
    try {
      await callback(step, progress);
    } catch (error) {
      console.error('Progress callback error:', error);
    }
  }
}

/**
 * Trigger workflow via EpisodeActor
 * This function wraps the workflow and coordinates with the EpisodeActor
 *
 * @param env - Environment bindings
 * @param episodeId - Episode ID
 * @returns Generation result
 */
export async function triggerPodcastGeneration(
  env: Bindings,
  episodeId: string
): Promise<PodcastGenerationResult> {
  // Get EpisodeActor stub
  const actorId = env.EPISODE_ACTOR.idFromName(episodeId);
  const actor = env.EPISODE_ACTOR.get(actorId);

  // Check if workflow is already running
  const statusResponse = await actor.fetch(
    new Request(`https://actor.internal/status?episodeId=${episodeId}`)
  );
  const statusData = await statusResponse.json() as { success: boolean; data: any };

  if (
    statusData.data.status !== 'idle' &&
    statusData.data.status !== 'completed' &&
    statusData.data.status !== 'failed'
  ) {
    return {
      success: false,
      error: 'Podcast generation already in progress for this episode',
    };
  }

  // Start workflow
  await actor.fetch(
    new Request(`https://actor.internal/start?episodeId=${episodeId}`, {
      method: 'POST',
    })
  );

  // Progress callback to update actor
  const progressCallback: ProgressCallback = async (step, progress) => {
    await actor.fetch(
      new Request(`https://actor.internal/update?episodeId=${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: step, progress }),
      })
    );
  };

  // Run the workflow
  const result = await generatePodcastDemoWorkflow(env, episodeId, progressCallback);

  // Update actor with result
  if (result.success) {
    await actor.fetch(
      new Request(`https://actor.internal/complete?episodeId=${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptId: result.transcriptId,
          audioVersionId: result.audioVersionId,
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
