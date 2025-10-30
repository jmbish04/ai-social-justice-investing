/**
 * AudioPlayerContext tests - verifies persistence and playback helpers.
 *
 * These React-focused tests confirm that the audio player provider restores
 * persisted tracks from localStorage and writes new state when playEpisode
 * is invoked. The suite relies on vitest with jsdom and Testing Library
 * renderHook utilities.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AudioPlayerProvider, useAudioPlayerContext } from '../AudioPlayerContext';
import { useAudioPlayer } from '../../ui/audio/useAudioPlayer';

const STORAGE_KEY = 'sji.audioPlayer.v1';

/**
 * Wrapper component used to supply the AudioPlayerProvider to hooks under test.
 * @param children - Nested hook tree being evaluated
 * @returns Provider-wrapped children
 */
function ProviderWrapper({ children }: PropsWithChildren): JSX.Element {
  return <AudioPlayerProvider>{children}</AudioPlayerProvider>;
}

describe('AudioPlayerContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores persisted track metadata when the provider mounts', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentTrack: {
          episodeId: 'episode-42',
          episodeTitle: 'Persisted Episode',
          audioUrl: 'https://cdn.example.com/audio.mp3',
          version: 3,
        },
        currentTime: 87,
        volume: 0.35,
      })
    );

    const { result } = renderHook(() => useAudioPlayerContext(), { wrapper: ProviderWrapper });

    await waitFor(() => {
      expect(result.current.currentTrack?.episodeId).toBe('episode-42');
    });

    expect(result.current.currentTrack?.version).toBe(3);
    expect(result.current.currentTime).toBeCloseTo(87);
    expect(result.current.volume).toBeCloseTo(0.35);
  });

  it('persists state changes when playEpisode is called', async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper: ProviderWrapper });

    act(() => {
      result.current.playEpisode({
        episodeId: 'episode-100',
        episodeTitle: 'Autosave Insights',
        audioUrl: 'https://cdn.example.com/new.mp3',
        version: 5,
      });
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.episodeId).toBe('episode-100');
    });

    await waitFor(() => {
      const persistedRaw = localStorage.getItem(STORAGE_KEY);
      expect(persistedRaw).toBeTruthy();
      const persisted = JSON.parse(persistedRaw!);
      expect(persisted.currentTrack.episodeId).toBe('episode-100');
      expect(persisted.currentTrack.version).toBe(5);
    });
  });
});
