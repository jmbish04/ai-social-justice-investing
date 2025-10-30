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

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';

      // Event listeners
      const audio = audioRef.current;

      const handleTimeUpdate = () => {
        setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
      };

      const handleDurationChange = () => {
        setState((prev) => ({ ...prev, duration: audio.duration }));
      };

      const handleEnded = () => {
        setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
      };

      const handleError = (e: ErrorEvent) => {
        console.error('Audio playback error:', e);
        setState((prev) => ({ ...prev, isPlaying: false }));
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError as any);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError as any);
        audio.pause();
      };
    }
  }, []);

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
      {/* Persistent audio player UI */}
      {state.currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={state.isPlaying ? pause : resume}
                className="btn-primary"
              >
                {state.isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium">{state.currentTrack.episodeTitle}</div>
                <div className="text-xs text-gray-500">
                  Version {state.currentTrack.version}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {formatTime(state.currentTime)} / {formatTime(state.duration)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={state.duration || 0}
                  value={state.currentTime}
                  onChange={(e) => seek(parseFloat(e.target.value))}
                  className="w-32"
                />
                <button onClick={stop} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
}

/**
 * Hook to use audio player context
 */
export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return context;
}

/**
 * Format time in MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
