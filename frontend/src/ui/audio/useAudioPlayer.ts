/**
 * useAudioPlayer - UI-friendly hook for controlling the global audio player
 *
 * This hook wraps the core AudioPlayerContext and exposes convenience helpers
 * for episode playback metadata. It ensures a consistent interface for any UI
 * component that needs to control the persistent audio player surface.
 */

import { useMemo } from 'react';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';

/**
 * Episode track metadata shape used across the UI layer
 */
export interface EpisodeAudioTrack {
  episodeId: string;
  episodeTitle: string;
  audioUrl: string;
  version: number;
}

/**
 * Hook returning the audio controller utilities with a UI-focused helper
 * @returns Audio player state and helpers including playEpisode helper
 */
export function useAudioPlayer() {
  const controller = useAudioPlayerContext();

  const helpers = useMemo(() => ({
    /**
     * Play the provided episode track while ensuring metadata is preserved
     * @param track - Episode audio metadata including URL and version
     */
    playEpisode(track: EpisodeAudioTrack) {
      controller.play(track);
    },
  }), [controller]);

  return {
    ...controller,
    ...helpers,
  };
}
