/**
 * GuestAgent - Dynamically instantiated AI agent for podcast guests
 *
 * This agent is created for each guest based on their profile from the
 * guest_profiles table in D1. It simulates the guest's expertise, tone,
 * and perspective during podcast conversations.
 *
 * @module agents/GuestAgent
 */

import { Bindings, GuestProfile } from '../types/bindings';

/**
 * GuestAgent class for representing podcast guests
 */
export class GuestAgent {
  private env: Bindings;
  private profile: GuestProfile;
  private conversationHistory: Array<{ role: string; content: string }>;
  private systemPrompt: string;

  /**
   * Creates a new GuestAgent instance
   * @param env - Cloudflare Worker environment bindings
   * @param profile - Guest profile from database
   */
  constructor(env: Bindings, profile: GuestProfile) {
    this.env = env;
    this.profile = profile;
    this.systemPrompt = this.buildSystemPrompt();
    this.conversationHistory = [
      {
        role: 'system',
        content: this.systemPrompt,
      },
    ];
  }

  /**
   * Build system prompt from guest profile
   * @returns System prompt string
   */
  private buildSystemPrompt(): string {
    return `You are ${this.profile.name}, a guest on The Social Justice Investor podcast.

Persona Description:
${this.profile.persona_description}

${this.profile.expertise ? `Your Areas of Expertise:\n${this.profile.expertise}\n` : ''}
${this.profile.tone ? `Speaking Tone/Style:\n${this.profile.tone}\n` : ''}
${this.profile.background ? `Background:\n${this.profile.background}\n` : ''}

Instructions:
- Speak authentically from your expertise and perspective
- Stay true to your persona and values
- Engage thoughtfully with the host and other guests
- Share specific examples and insights when relevant
- Keep responses conversational and natural (2-4 sentences typically)
- Don't be afraid to respectfully challenge or build on ideas`;
  }

  /**
   * Generate a response from the guest agent
   * @param context - Conversation context or question from host
   * @param otherGuestResponses - Optional responses from other guests
   * @returns Guest's response
   */
  async generateResponse(
    context: string,
    otherGuestResponses?: Array<{ guestName: string; response: string }>
  ): Promise<string> {
    // Build the prompt
    let prompt = context;

    if (otherGuestResponses && otherGuestResponses.length > 0) {
      prompt += '\n\nOther guests have shared:\n';
      otherGuestResponses.forEach(({ guestName, response }) => {
        prompt += `${guestName}: "${response}"\n`;
      });
      prompt += '\nYour response:';
    }

    this.conversationHistory.push({
      role: 'user',
      content: prompt,
    });

    try {
      // Call Workers AI with the reasoning model
      const response = await this.env.AI.run(this.env.MODEL_REASONING, {
        messages: this.conversationHistory,
        max_tokens: 400,
        temperature: 0.75,
      });

      const assistantMessage = response.response || '';

      // Store in conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Keep history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 21) {
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-20),
        ];
      }

      return assistantMessage;
    } catch (error) {
      console.error(`GuestAgent error (${this.profile.name}):`, error);
      throw new Error(`Failed to generate guest response for ${this.profile.name}`);
    }
  }

  /**
   * Generate initial perspective on episode topic
   * @param episodeTitle - Title of the episode
   * @param episodeDescription - Description of the episode
   * @returns Initial thoughts on the topic
   */
  async generateInitialThoughts(
    episodeTitle: string,
    episodeDescription: string
  ): Promise<string> {
    const prompt = `The podcast host is introducing this episode:

Title: ${episodeTitle}
Description: ${episodeDescription}

What are your initial thoughts on this topic? Share your perspective in 2-3 sentences.`;

    return this.generateResponse(prompt);
  }

  /**
   * Generate a response to the host's question
   * @param question - Question from the host
   * @returns Guest's answer
   */
  async answerQuestion(question: string): Promise<string> {
    const prompt = `The host asks you: "${question}"

Please provide a thoughtful answer based on your expertise and perspective.`;

    return this.generateResponse(prompt);
  }

  /**
   * React to another guest's statement
   * @param otherGuestName - Name of the other guest
   * @param statement - The other guest's statement
   * @returns Your reaction or addition
   */
  async reactToGuest(otherGuestName: string, statement: string): Promise<string> {
    const prompt = `${otherGuestName} just said: "${statement}"

React to this point. You can build on it, offer a complementary perspective,
or respectfully challenge it with your own insights. Keep it conversational (2-3 sentences).`;

    return this.generateResponse(prompt);
  }

  /**
   * Get guest profile information
   * @returns Guest profile
   */
  getProfile(): GuestProfile {
    return this.profile;
  }

  /**
   * Get guest name
   * @returns Guest name
   */
  getName(): string {
    return this.profile.name;
  }

  /**
   * Reset conversation history (for new episodes)
   */
  reset(): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: this.systemPrompt,
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

  /**
   * Static method to load a guest from the database
   * @param env - Cloudflare Worker environment bindings
   * @param guestProfileId - ID of the guest profile
   * @returns GuestAgent instance or null if not found
   */
  static async loadFromDatabase(env: Bindings, guestProfileId: string): Promise<GuestAgent | null> {
    try {
      const result = await env.DB.prepare(
        'SELECT * FROM guest_profiles WHERE id = ?'
      )
        .bind(guestProfileId)
        .first<GuestProfile>();

      if (!result) {
        return null;
      }

      return new GuestAgent(env, result);
    } catch (error) {
      console.error('Error loading guest from database:', error);
      return null;
    }
  }
}
