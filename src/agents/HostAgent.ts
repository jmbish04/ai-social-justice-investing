/**
 * HostAgent - AI agent embodying Andrea Longton's persona
 *
 * This agent simulates Andrea Longton's voice and personality as the host
 * of "The Social Justice Investor" podcast. It maintains her optimistic,
 * pragmatic tone while focusing on equity, access, and systems repair.
 *
 * @module agents/HostAgent
 */

import { Bindings } from '../types/bindings';

/**
 * System prompt defining Andrea Longton's persona
 */
const HOST_SYSTEM_PROMPT = `You are Andrea Longton's AI co-host.
You embody her optimistic and pragmatic tone from The Social Justice Investor.
Focus on equity, access, and systems repair.
Be warm, informed, and bridge finance with ethics.

Key characteristics:
- Optimistic yet grounded in reality
- Passionate about financial equity and social justice
- Uses accessible language to explain complex topics
- Asks thoughtful questions that dig deeper
- Builds on guests' ideas with relevant examples
- Maintains conversational warmth while staying professional`;

/**
 * HostAgent class for podcast conversations
 */
export class HostAgent {
  private env: Bindings;
  private conversationHistory: Array<{ role: string; content: string }>;

  /**
   * Creates a new HostAgent instance
   * @param env - Cloudflare Worker environment bindings
   */
  constructor(env: Bindings) {
    this.env = env;
    this.conversationHistory = [
      {
        role: 'system',
        content: HOST_SYSTEM_PROMPT,
      },
    ];
  }

  /**
   * Generate a response from the host agent
   * @param context - Conversation context or prompt
   * @param guestResponse - Optional previous guest response to react to
   * @returns Host's response
   */
  async generateResponse(context: string, guestResponse?: string): Promise<string> {
    // Build the prompt
    let prompt = context;
    if (guestResponse) {
      prompt = `Guest just said: "${guestResponse}"\n\nYour response as host:`;
    }

    this.conversationHistory.push({
      role: 'user',
      content: prompt,
    });

    try {
      // Call Workers AI with the reasoning model
      const response = await this.env.AI.run(this.env.MODEL_REASONING, {
        messages: this.conversationHistory,
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage = response.response || '';

      // Store in conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Keep history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 21) {
        // Keep system prompt + last 20 messages
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-20),
        ];
      }

      return assistantMessage;
    } catch (error) {
      console.error('HostAgent error:', error);
      throw new Error('Failed to generate host response');
    }
  }

  /**
   * Generate opening remarks for a podcast episode
   * @param episodeTitle - Title of the episode
   * @param episodeDescription - Description of the episode
   * @param guestNames - Names of the guests
   * @returns Opening remarks
   */
  async generateOpening(
    episodeTitle: string,
    episodeDescription: string,
    guestNames: string[]
  ): Promise<string> {
    const prompt = `Generate opening remarks for a podcast episode.

Episode Title: ${episodeTitle}
Description: ${episodeDescription}
Guests: ${guestNames.join(', ')}

Create a warm, engaging introduction that:
1. Welcomes listeners to The Social Justice Investor
2. Introduces the episode topic
3. Welcomes the guest(s) by name
4. Sets up the main themes to be discussed

Keep it conversational and under 200 words.`;

    return this.generateResponse(prompt);
  }

  /**
   * Generate transition or follow-up question
   * @param topic - Current topic being discussed
   * @param previousStatement - Previous statement to build on
   * @returns Follow-up question or transition
   */
  async generateFollowUp(topic: string, previousStatement: string): Promise<string> {
    const prompt = `We're discussing: ${topic}

The guest just said: "${previousStatement}"

Generate a thoughtful follow-up question or comment that:
- Digs deeper into their point
- Connects to social justice and equity themes
- Encourages further elaboration
- Stays conversational and warm

Keep it brief (1-2 sentences).`;

    return this.generateResponse(prompt);
  }

  /**
   * Generate closing remarks for the episode
   * @param keyTakeaways - Key points discussed in the episode
   * @returns Closing remarks
   */
  async generateClosing(keyTakeaways: string[]): Promise<string> {
    const prompt = `Generate closing remarks for the podcast episode.

Key takeaways from our conversation:
${keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Create a warm, inspiring closing that:
1. Summarizes the key themes
2. Thanks the guest(s)
3. Reminds listeners of the show's mission
4. Includes a call to action or thought-provoking final statement

Keep it conversational and under 150 words.`;

    return this.generateResponse(prompt);
  }

  /**
   * Reset conversation history (for new episodes)
   */
  reset(): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: HOST_SYSTEM_PROMPT,
      },
    ];
  }

  /**
   * Get current conversation history
   * @returns Conversation history
   */
  getHistory(): Array<{ role: string; content: string }> {
    return this.conversationHistory;
  }

  /**
   * Load conversation history from storage
   * @param history - Conversation history to load
   */
  loadHistory(history: Array<{ role: string; content: string }>): void {
    this.conversationHistory = history;
  }
}
