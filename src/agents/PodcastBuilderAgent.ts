/**
 * PodcastBuilderAgent - Orchestrates transcript generation for multi-guest podcasts
 *
 * This agent coordinates the Host and Guest agents to generate structured
 * podcast transcripts with natural multi-way conversations. It handles:
 * - Episode outline generation
 * - Turn-taking between participants
 * - Conversation flow and pacing
 * - Transcript formatting and structure
 *
 * @module agents/PodcastBuilderAgent
 */

import { Bindings, Episode, GuestProfile } from '../types/bindings';
import { HostAgent } from './HostAgent';
import { GuestAgent } from './GuestAgent';

/**
 * Transcript segment representing one speaker's turn
 */
interface TranscriptSegment {
  speaker: string; // 'host' or guest name
  speakerType: 'host' | 'guest';
  content: string;
  timestamp?: number;
}

/**
 * Episode outline structure
 */
interface EpisodeOutline {
  title: string;
  introduction: string;
  segments: Array<{
    topic: string;
    keyPoints: string[];
    estimatedTurns: number;
  }>;
  conclusion: string;
}

/**
 * PodcastBuilderAgent class
 */
export class PodcastBuilderAgent {
  private env: Bindings;
  private hostAgent: HostAgent;
  private guestAgents: GuestAgent[];
  private transcript: TranscriptSegment[];

  /**
   * Creates a new PodcastBuilderAgent
   * @param env - Cloudflare Worker environment bindings
   * @param hostAgent - Initialized host agent
   * @param guestAgents - Array of initialized guest agents
   */
  constructor(env: Bindings, hostAgent: HostAgent, guestAgents: GuestAgent[]) {
    this.env = env;
    this.hostAgent = hostAgent;
    this.guestAgents = guestAgents;
    this.transcript = [];
  }

  /**
   * Generate an episode outline based on episode metadata
   * @param episode - Episode metadata
   * @returns Structured outline
   */
  async generateOutline(episode: { title: string; description: string }): Promise<EpisodeOutline> {
    const guestNames = this.guestAgents.map(g => g.getName()).join(', ');

    const prompt = `Create a structured podcast outline for this episode:

Title: ${episode.title}
Description: ${episode.description}
Host: Andrea Longton
Guests: ${guestNames}

Generate a JSON outline with this structure:
{
  "title": "episode title",
  "introduction": "brief intro overview",
  "segments": [
    {
      "topic": "segment topic",
      "keyPoints": ["point 1", "point 2", ...],
      "estimatedTurns": number
    }
  ],
  "conclusion": "closing theme"
}

Focus on 3-5 main segments that explore social justice, AI ethics, and financial equity themes.`;

    try {
      const response = await this.env.AI.run(this.env.MODEL_REASONING, {
        messages: [
          { role: 'system', content: 'You are an expert podcast producer.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
      });

      // Parse the response as JSON
      const outlineText = response.response || '{}';
      const outline: EpisodeOutline = JSON.parse(outlineText);

      return outline;
    } catch (error) {
      console.error('Error generating outline:', error);
      // Return a default outline
      return {
        title: episode.title,
        introduction: episode.description,
        segments: [
          {
            topic: 'Main Discussion',
            keyPoints: ['Explore the key themes', 'Share perspectives', 'Discuss implications'],
            estimatedTurns: 10,
          },
        ],
        conclusion: 'Wrap up and key takeaways',
      };
    }
  }

  /**
   * Generate a complete podcast transcript
   * @param episode - Episode metadata
   * @param outline - Episode outline (optional, will generate if not provided)
   * @returns Complete transcript as markdown
   */
  async generateTranscript(
    episode: { title: string; description: string },
    outline?: EpisodeOutline
  ): Promise<string> {
    // Generate outline if not provided
    if (!outline) {
      outline = await this.generateOutline(episode);
    }

    // Reset all agents
    this.hostAgent.reset();
    this.guestAgents.forEach(g => g.reset());
    this.transcript = [];

    // 1. Opening
    await this.generateOpening(episode, outline);

    // 2. Main segments
    for (const segment of outline.segments) {
      await this.generateSegment(segment);
    }

    // 3. Closing
    await this.generateClosing();

    // 4. Format as markdown
    return this.formatTranscript(episode.title);
  }

  /**
   * Generate a structured transcript package that includes metadata needed by downstream workflows.
   * @param episode - Episode metadata used for prompt context
   * @param outline - Optional precomputed outline to avoid regenerating one
   * @returns Object containing markdown transcript text, resolved outline, transcript segments, and word count
   */
  async generateTranscriptPackage(
    episode: { title: string; description: string },
    outline?: EpisodeOutline
  ): Promise<{
    text: string;
    outline: EpisodeOutline;
    segments: TranscriptSegment[];
    wordCount: number;
  }> {
    const resolvedOutline = outline ?? (await this.generateOutline(episode));
    const text = await this.generateTranscript(episode, resolvedOutline);

    return {
      text,
      outline: resolvedOutline,
      segments: this.getTranscriptSegments().map(segment => ({ ...segment })),
      wordCount: this.getWordCount(),
    };
  }

  /**
   * Generate opening segment
   */
  private async generateOpening(
    episode: { title: string; description: string },
    outline: EpisodeOutline
  ): Promise<void> {
    const guestNames = this.guestAgents.map(g => g.getName());

    // Host opens the show
    const opening = await this.hostAgent.generateOpening(
      episode.title,
      episode.description,
      guestNames
    );

    this.addSegment('host', 'host', opening);

    // Each guest shares initial thoughts
    for (const guest of this.guestAgents) {
      const thoughts = await guest.generateInitialThoughts(episode.title, episode.description);
      this.addSegment(guest.getName(), 'guest', thoughts);
    }
  }

  /**
   * Generate a conversation segment
   */
  private async generateSegment(segment: {
    topic: string;
    keyPoints: string[];
    estimatedTurns: number;
  }): Promise<void> {
    // Host introduces the segment
    const intro = await this.hostAgent.generateResponse(
      `Introduce this segment: ${segment.topic}\nKey points to cover: ${segment.keyPoints.join(', ')}`
    );
    this.addSegment('host', 'host', intro);

    // Alternate between guests and host
    for (let turn = 0; turn < segment.estimatedTurns; turn++) {
      // Pick a guest (round-robin)
      const guestIndex = turn % this.guestAgents.length;
      const guest = this.guestAgents[guestIndex];

      // Guest responds
      const keyPoint = segment.keyPoints[turn % segment.keyPoints.length];
      const guestResponse = await guest.generateResponse(
        `Share your thoughts on: ${keyPoint} (related to ${segment.topic})`
      );
      this.addSegment(guest.getName(), 'guest', guestResponse);

      // Host follows up (every other turn)
      if (turn % 2 === 1) {
        const followUp = await this.hostAgent.generateFollowUp(segment.topic, guestResponse);
        this.addSegment('host', 'host', followUp);
      }
    }
  }

  /**
   * Generate closing segment
   */
  private async generateClosing(): Promise<void> {
    // Extract key takeaways from the conversation
    const keyTakeaways = this.transcript
      .filter(s => s.speakerType === 'guest')
      .slice(-3)
      .map(s => s.content.substring(0, 100));

    const closing = await this.hostAgent.generateClosing(keyTakeaways);
    this.addSegment('host', 'host', closing);
  }

  /**
   * Add a segment to the transcript
   */
  private addSegment(speaker: string, speakerType: 'host' | 'guest', content: string): void {
    this.transcript.push({
      speaker,
      speakerType,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Format transcript as markdown
   * @param episodeTitle - Title of the episode
   * @returns Formatted markdown transcript
   */
  private formatTranscript(episodeTitle: string): string {
    let markdown = `# ${episodeTitle}\n\n`;
    markdown += `## Transcript\n\n`;
    markdown += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
    markdown += `---\n\n`;

    for (const segment of this.transcript) {
      const speakerLabel = segment.speakerType === 'host' ? '**Andrea Longton**' : `**${segment.speaker}**`;
      markdown += `${speakerLabel}: ${segment.content}\n\n`;
    }

    markdown += `---\n\n`;
    markdown += `*End of transcript*\n`;

    return markdown;
  }

  /**
   * Get the raw transcript segments
   * @returns Array of transcript segments
   */
  getTranscriptSegments(): TranscriptSegment[] {
    return this.transcript;
  }

  /**
   * Calculate estimated word count
   * @returns Word count
   */
  getWordCount(): number {
    return this.transcript.reduce((count, segment) => {
      return count + segment.content.split(/\s+/).length;
    }, 0);
  }

  /**
   * Static factory method to create PodcastBuilderAgent with guests from database
   * @param env - Cloudflare Worker environment bindings
   * @param episodeId - ID of the episode
   * @returns PodcastBuilderAgent instance or null
   */
  static async createForEpisode(env: Bindings, episodeId: string): Promise<PodcastBuilderAgent | null> {
    try {
      // Fetch guest profiles for this episode
      const guestLinks = await env.DB.prepare(
        'SELECT guest_profile_id FROM episode_guests WHERE episode_id = ?'
      )
        .bind(episodeId)
        .all<{ guest_profile_id: string }>();

      if (!guestLinks.results || guestLinks.results.length === 0) {
        console.error('No guests found for episode:', episodeId);
        return null;
      }

      // Load guest agents
      const guestAgents: GuestAgent[] = [];
      for (const link of guestLinks.results) {
        const guest = await GuestAgent.loadFromDatabase(env, link.guest_profile_id);
        if (guest) {
          guestAgents.push(guest);
        }
      }

      if (guestAgents.length === 0) {
        console.error('Failed to load any guest agents');
        return null;
      }

      // Create host agent
      const hostAgent = new HostAgent(env);

      return new PodcastBuilderAgent(env, hostAgent, guestAgents);
    } catch (error) {
      console.error('Error creating PodcastBuilderAgent:', error);
      return null;
    }
  }
}
