/**
 * AudioPlayerRoot - Persistent global audio player surface
 *
 * Renders a sticky bottom playback bar that consumes the audio player
 * context. It exposes transport controls, track metadata, scrubbing, and
 * volume adjustments while supporting minimised display for mobile devices.
 */

import React, { useState } from 'react';
import { useAudioPlayer } from './useAudioPlayer';

/**
 * Format playback seconds into mm:ss format for display
 * @param seconds - Playback position in seconds
 * @returns Formatted mm:ss string
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Persistent audio UI component
 */
export function AudioPlayerRoot(): JSX.Element | null {
  const { currentTrack, isPlaying, currentTime, duration, seek, pause, resume, stop, setVolume, volume } = useAudioPlayer();
  const [expanded, setExpanded] = useState(true);

  if (!currentTrack) {
    return null;
  }

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-700"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{currentTrack.episodeTitle}</p>
                <p className="text-xs text-gray-500">Version {currentTrack.version}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {expanded ? 'Hide details' : 'Show details'}
              </button>
            </div>

            {expanded && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => seek(parseFloat(event.target.value))}
                    className="flex-1"
                    aria-label="Seek audio"
                  />
                  <span>{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span>🔊</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(event) => setVolume(parseFloat(event.target.value))}
                      className="w-28"
                      aria-label="Adjust volume"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Stop
                    </button>
                    <a
                      href={currentTrack.audioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Open in new tab
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
