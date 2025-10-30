/**
 * TranscriptEditor - Rich editing surface for podcast transcripts
 *
 * Provides autosave, version diffing, and manual "save as new version"
 * functionality for generated transcripts.
 */

import React, { useEffect, useMemo, useState } from 'react';

/**
 * Transcript version shape consumed by the editor
 */
export interface TranscriptVersion {
  id: string;
  version: number;
  body: string;
  created_at: number;
  format?: string;
  word_count?: number | null;
}

/**
 * Props for TranscriptEditor component
 */
export interface TranscriptEditorProps {
  transcript: TranscriptVersion | null;
  loading: boolean;
  onAutosave: (transcriptId: string, body: string) => Promise<TranscriptVersion>;
  onCreateVersion: (body: string) => Promise<TranscriptVersion>;
}

/**
 * Segment produced by diff algorithm
 */
interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

/**
 * Compute a simple line-based diff using dynamic programming
 * @param original - Original text to diff against
 * @param updated - Updated draft text
 * @returns Array of diff segments for rendering
 */
function diffLines(original: string, updated: string): DiffSegment[] {
  const originalLines = original.split('\n');
  const updatedLines = updated.split('\n');
  const dp: number[][] = Array.from({ length: originalLines.length + 1 }, () =>
    Array(updatedLines.length + 1).fill(0)
  );

  for (let i = originalLines.length - 1; i >= 0; i -= 1) {
    for (let j = updatedLines.length - 1; j >= 0; j -= 1) {
      if (originalLines[i] === updatedLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < originalLines.length && j < updatedLines.length) {
    if (originalLines[i] === updatedLines[j]) {
      segments.push({ type: 'same', text: originalLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'removed', text: originalLines[i] });
      i += 1;
    } else {
      segments.push({ type: 'added', text: updatedLines[j] });
      j += 1;
    }
  }

  while (i < originalLines.length) {
    segments.push({ type: 'removed', text: originalLines[i] });
    i += 1;
  }

  while (j < updatedLines.length) {
    segments.push({ type: 'added', text: updatedLines[j] });
    j += 1;
  }

  return segments;
}

/**
 * Transcript editor component
 */
export function TranscriptEditor({
  transcript,
  loading,
  onAutosave,
  onCreateVersion,
}: TranscriptEditorProps): JSX.Element {
  const [draft, setDraft] = useState(transcript?.body ?? '');
  const [status, setStatus] = useState<'idle' | 'draft' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(transcript?.body ?? '');
    setStatus('idle');
    setError(null);
  }, [transcript?.id]);

  useEffect(() => {
    if (!transcript) {
      return;
    }

    if (draft === transcript.body) {
      return;
    }

    setStatus('draft');
    setError(null);

    const handler = setTimeout(async () => {
      try {
        setStatus('saving');
        const updated = await onAutosave(transcript.id, draft);
        setDraft(updated.body);
        setStatus('saved');
      } catch (autosaveError) {
        console.error('Autosave failed:', autosaveError);
        setStatus('error');
        setError('Autosave failed. Please try again.');
      }
    }, 5000);

    return () => clearTimeout(handler);
  }, [draft, transcript, onAutosave]);

  const diff = useMemo(() => {
    if (!transcript) {
      return [] as DiffSegment[];
    }
    return diffLines(transcript.body, draft);
  }, [transcript, draft]);

  if (loading) {
    return (
      <div className="card">
        <div className="text-gray-500">Loading transcript…</div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="card">
        <div className="text-gray-500">No transcript available yet. Generate a demo to create one.</div>
      </div>
    );
  }

  const handleManualSave = async () => {
    try {
      setStatus('saving');
      await onCreateVersion(draft);
      setStatus('saved');
    } catch (saveError) {
      console.error('Failed to create transcript version:', saveError);
      setStatus('error');
      setError('Failed to create new transcript version.');
    }
  };

  return (
    <div className="card space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Transcript</h2>
          <p className="text-sm text-gray-500">
            Version {transcript.version} · Last generated {new Date(transcript.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {status === 'draft' && <span className="text-amber-600">Draft changes detected…</span>}
          {status === 'saving' && <span className="text-indigo-600">Saving…</span>}
          {status === 'saved' && <span className="text-emerald-600">Saved</span>}
          {status === 'error' && <span className="text-red-600">{error}</span>}
          <button
            type="button"
            onClick={handleManualSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Save as New Version
          </button>
        </div>
      </header>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={16}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder="Transcript content…"
      />

      <section>
        <h3 className="text-sm font-semibold text-gray-700">Changes since last save</h3>
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs font-mono">
          {diff.length === 0 && <p className="text-gray-500">No changes yet.</p>}
          {diff.map((segment, index) => {
            if (segment.type === 'same') {
              return (
                <div key={`same-${index}`} className="text-gray-600">
                  {segment.text}
                </div>
              );
            }
            if (segment.type === 'added') {
              return (
                <div key={`added-${index}`} className="text-emerald-700">
                  + {segment.text}
                </div>
              );
            }
            return (
              <div key={`removed-${index}`} className="text-red-600 line-through">
                − {segment.text}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
