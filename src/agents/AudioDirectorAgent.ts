/**
 * AudioDirectorAgent - Orchestrates audio generation and R2 storage
 *
 * This agent handles the audio production pipeline:
 * - Text-to-speech synthesis for each transcript segment
 * - Audio file concatenation and processing
 * - Upload to R2 storage with proper metadata
 * - Generation of public URLs for playback
 *
 * Note: This is currently a stub implementation. Full TTS integration
 * would require additional Cloudflare AI audio models or external services.
 *
 * @module agents/AudioDirectorAgent
 */

import { Bindings } from '../types/bindings';

/**
 * Audio segment metadata
 */
interface AudioSegment {
  speaker: string;
  text: string;
  audioData?: ArrayBuffer;
  duration?: number;
}

/**
 * Audio generation result
 */
interface AudioResult {
  r2Key: string;
  r2Url: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

/**
 * AudioDirectorAgent class
 */
export class AudioDirectorAgent {
  private env: Bindings;

  /**
   * Creates a new AudioDirectorAgent
   * @param env - Cloudflare Worker environment bindings
   */
  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Generate audio from transcript segments and upload to R2
   * @param episodeId - Episode ID
   * @param version - Version number
   * @param segments - Transcript segments with speaker and text
   * @returns Audio file metadata
   */
  async generateAndUploadAudio(
    episodeId: string,
    version: number,
    segments: Array<{ speaker: string; text: string }>
  ): Promise<AudioResult> {
    try {
      // Convert segments to audio
      const audioSegments = await this.generateAudioSegments(segments);

      // Concatenate audio segments
      const finalAudio = await this.concatenateAudio(audioSegments);

      // Upload to R2
      const r2Key = `podcasts/${episodeId}/v${version}.mp3`;
      const uploadResult = await this.uploadToR2(r2Key, finalAudio);

      return uploadResult;
    } catch (error) {
      console.error('Error generating audio:', error);
      throw new Error('Audio generation failed');
    }
  }

  /**
   * Generate an in-memory audio placeholder for a full transcript.
   * The result mimics what a future TTS pipeline would return while keeping
   * the rest of the workflow interface stable.
   *
   * @param transcriptText - Full transcript content to convert into audio
   * @returns Placeholder audio buffer with lightweight metadata
   */
  async generateAudio(
    transcriptText: string
  ): Promise<{ buffer: ArrayBuffer; meta: { durationSeconds: number; wordCount: number } }> {
    const normalized = transcriptText.trim();
    const wordCount = normalized.length > 0 ? normalized.split(/\s+/).length : 0;
    const durationSeconds = this.estimateDuration(normalized);

    const payload = {
      type: 'podcast-audio-placeholder',
      generatedAt: new Date().toISOString(),
      durationSeconds,
      wordCount,
      preview: normalized.substring(0, 400),
      note: 'Replace with Workers AI TTS output when available.',
    };

    const buffer = new TextEncoder().encode(JSON.stringify(payload, null, 2)).buffer;

    return { buffer, meta: { durationSeconds, wordCount } };
  }

  /**
   * Generate audio for individual transcript segments
   * NOTE: This is a stub implementation. Real TTS would use:
   * - Cloudflare AI TTS models (when available)
   * - External TTS APIs (ElevenLabs, Azure, etc.)
   * - Pre-recorded voice samples
   *
   * @param segments - Text segments to convert
   * @returns Audio segments with metadata
   */
  private async generateAudioSegments(
    segments: Array<{ speaker: string; text: string }>
  ): Promise<AudioSegment[]> {
    const audioSegments: AudioSegment[] = [];

    for (const segment of segments) {
      // Stub: In production, this would call a TTS service
      // For now, we'll create a placeholder
      const estimatedDuration = this.estimateDuration(segment.text);

      audioSegments.push({
        speaker: segment.speaker,
        text: segment.text,
        audioData: undefined, // Would contain actual audio data
        duration: estimatedDuration,
      });

      // Log for debugging
      console.log(`Generated audio segment for ${segment.speaker}: ${estimatedDuration}s`);
    }

    return audioSegments;
  }

  /**
   * Estimate audio duration based on text length
   * Uses average speaking rate of ~150 words per minute
   * @param text - Text content
   * @returns Estimated duration in seconds
   */
  private estimateDuration(text: string): number {
    const wordCount = text.split(/\s+/).length;
    const wordsPerSecond = 150 / 60; // ~2.5 words/second
    return Math.ceil(wordCount / wordsPerSecond);
  }

  /**
   * Concatenate audio segments into a single file
   * NOTE: Stub implementation
   * @param segments - Audio segments to concatenate
   * @returns Combined audio data
   */
  private async concatenateAudio(segments: AudioSegment[]): Promise<ArrayBuffer> {
    // Stub: In production, this would use ffmpeg or similar
    // to concatenate audio files with proper crossfading

    // For now, create a minimal MP3-like structure (placeholder)
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

    // Create a simple text-based placeholder file
    const metadata = {
      type: 'podcast-audio-placeholder',
      format: 'mp3',
      durationSeconds: totalDuration,
      segments: segments.map(s => ({
        speaker: s.speaker,
        text: s.text.substring(0, 100) + '...',
        duration: s.duration,
      })),
      note: 'This is a placeholder. Real audio generation requires TTS integration.',
    };

    const jsonString = JSON.stringify(metadata, null, 2);
    return new TextEncoder().encode(jsonString).buffer;
  }

  /**
   * Upload audio file to R2 storage
   * @param key - R2 object key
   * @param audioData - Audio file data
   * @returns Upload result with URL
   */
  private async uploadToR2(key: string, audioData: ArrayBuffer): Promise<AudioResult> {
    try {
      // Upload to R2
      await this.env.BUCKET.put(key, audioData, {
        httpMetadata: {
          contentType: 'audio/mpeg',
        },
        customMetadata: {
          uploadedAt: new Date().toISOString(),
          generatedBy: 'AudioDirectorAgent',
        },
      });

      // Calculate file size
      const fileSizeBytes = audioData.byteLength;

      // Estimate duration (would be exact with real audio)
      const durationSeconds = this.estimateDurationFromSize(fileSizeBytes);

      // Generate public URL
      const r2Url = `${this.env.R2_PUBLIC_URL}/${key}`;

      return {
        r2Key: key,
        r2Url,
        durationSeconds,
        fileSizeBytes,
      };
    } catch (error) {
      console.error('Error uploading to R2:', error);
      throw new Error('R2 upload failed');
    }
  }

  /**
   * Estimate duration from file size (very rough approximation)
   * Real implementation would parse audio metadata
   * @param bytes - File size in bytes
   * @returns Estimated duration in seconds
   */
  private estimateDurationFromSize(bytes: number): number {
    // Rough estimate: 128 kbps MP3 = ~16 KB/s
    const kbps = 128;
    const bytesPerSecond = (kbps * 1024) / 8;
    return Math.ceil(bytes / bytesPerSecond);
  }

  /**
   * Check if audio file exists in R2
   * @param key - R2 object key
   * @returns True if exists
   */
  async audioExists(key: string): Promise<boolean> {
    try {
      const obj = await this.env.BUCKET.head(key);
      return obj !== null;
    } catch {
      return false;
    }
  }

  /**
   * Delete audio file from R2
   * @param key - R2 object key
   */
  async deleteAudio(key: string): Promise<void> {
    try {
      await this.env.BUCKET.delete(key);
    } catch (error) {
      console.error('Error deleting audio from R2:', error);
      throw new Error('R2 deletion failed');
    }
  }

  /**
   * Generate audio preview (first 30 seconds)
   * Useful for quick previews before full generation
   * @param episodeId - Episode ID
   * @param segments - First few transcript segments
   * @returns Preview audio result
   */
  async generatePreview(
    episodeId: string,
    segments: Array<{ speaker: string; text: string }>
  ): Promise<AudioResult> {
    // Take only segments that would fit in ~30 seconds
    const previewSegments = [];
    let totalDuration = 0;
    const maxDuration = 30;

    for (const segment of segments) {
      const duration = this.estimateDuration(segment.text);
      if (totalDuration + duration > maxDuration) break;

      previewSegments.push(segment);
      totalDuration += duration;
    }

    // Generate preview with "preview" suffix
    const r2Key = `podcasts/${episodeId}/preview.mp3`;
    const audioSegments = await this.generateAudioSegments(previewSegments);
    const audio = await this.concatenateAudio(audioSegments);

    return this.uploadToR2(r2Key, audio);
  }
}
