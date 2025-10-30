/**
 * AudioPlayerContext - Global audio player state management
 *
 * This React Context provides global audio playback state and controls
 * for the persistent audio player. Ensures iOS compatibility and
 * seamless playback across page navigation.
 *
 * @module contexts/AudioPlayerContext
 */

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const STORAGE_KEY = 'sji.audioPlayer.v1';

/**
 * Audio player state interface
 */
interface AudioPlayerState {
  currentTrack: {
    episodeId: string;
    episodeTitle: string;
    audioUrl: string;
    version: number;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

/**
 * Audio player controls interface
 */
interface AudioPlayerControls {
  play: (track: {
    episodeId: string;
    episodeTitle: string;
    audioUrl: string;
    version: number;
  }) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
}

/**
 * Combined context value
 */
interface AudioPlayerContextValue extends AudioPlayerState, AudioPlayerControls {}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

/**
 * AudioPlayerProvider component
 */
export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AudioPlayerState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element and restore persisted state
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const persistedRaw = localStorage.getItem(STORAGE_KEY);
    if (persistedRaw) {
      try {
        const persisted = JSON.parse(persistedRaw) as {
          currentTrack?: AudioPlayerState['currentTrack'];
          currentTime?: number;
          volume?: number;
        };

        setState((prev) => ({
          ...prev,
          currentTrack: persisted.currentTrack || null,
          currentTime: persisted.currentTime || 0,
          volume: typeof persisted.volume === 'number' ? persisted.volume : prev.volume,
        }));

        if (persisted.currentTrack) {
          audio.src = persisted.currentTrack.audioUrl;
          audio.currentTime = persisted.currentTime || 0;
        }

        audio.volume = typeof persisted.volume === 'number' ? persisted.volume : audio.volume;
      } catch (error) {
        console.warn('Failed to restore audio player state:', error);
      }
    }

    const handleTimeUpdate = () => {
      setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
    };

    const handleDurationChange = () => {
      setState((prev) => ({ ...prev, duration: audio.duration }));
    };

    const handleEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
    };

    const handleError = () => {
      if (audioRef.current?.error) {
        console.error('Audio playback error:', audioRef.current.error);
        setState((prev) => ({ ...prev, isPlaying: false }));
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as any);
      audio.pause();
    };
  }, []);

  // Persist state updates
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
      currentTrack: state.currentTrack,
      currentTime: state.currentTrack ? state.currentTime : 0,
      volume: state.volume,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist audio player state:', error);
    }
  }, [state.currentTrack, state.currentTime, state.volume]);

  // Keep audio element volume aligned with state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  /**
   * Play a new track
   */
  const play = (track: AudioPlayerState['currentTrack']) => {
    if (!audioRef.current || !track) return;

    const audio = audioRef.current;

    // If playing a different track, load new source
    if (state.currentTrack?.audioUrl !== track.audioUrl) {
      audio.src = track.audioUrl;
      audio.load();
      audio.currentTime = 0;
    }

    audio
      .play()
      .then(() => {
        setState((prev) => ({
          ...prev,
          currentTrack: track,
          isPlaying: true,
        }));
      })
      .catch((error) => {
        console.error('Error playing audio:', error);
      });
  };

  /**
   * Pause playback
   */
  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  /**
   * Resume playback
   */
  const resume = () => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setState((prev) => ({ ...prev, isPlaying: true }));
        })
        .catch(console.error);
    }
  };

  /**
   * Seek to specific time
   */
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState((prev) => ({ ...prev, currentTime: time }));
    }
  };

  /**
   * Set volume (0-1)
   */
  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
      setState((prev) => ({ ...prev, volume }));
    }
  };

  /**
   * Stop playback
   */
  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
        currentTrack: null,
      }));
    }
  };

  const value: AudioPlayerContextValue = {
    ...state,
    play,
    pause,
    resume,
    seek,
    setVolume,
    stop,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

/**
 * Hook to use audio player context
 */
export function useAudioPlayerContext() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  }
  return context;
}
