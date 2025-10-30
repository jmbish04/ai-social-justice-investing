/**
 * ProgressOverlay - Full screen overlay showing workflow progress
 *
 * Displays current status text, a determinate progress bar, and optional
 * cancel button while the GeneratePodcastDemoWorkflow runs.
 */

import React from 'react';

/**
 * Props for ProgressOverlay
 */
export interface ProgressOverlayProps {
  isVisible: boolean;
  step: string;
  progress: number;
  onCancel?: () => void;
}

/**
 * Overlay component for long running tasks
 */
export function ProgressOverlay({ isVisible, step, progress, onCancel }: ProgressOverlayProps): JSX.Element | null {
  if (!isVisible) {
    return null;
  }

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Generating podcast demo…</h2>
            <p className="mt-1 text-sm text-gray-600">{step}</p>
          </div>
          <span className="text-sm font-medium text-gray-500">{Math.round(clampedProgress)}%</span>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
