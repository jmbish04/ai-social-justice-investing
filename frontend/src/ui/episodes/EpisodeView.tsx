/**
 * EpisodeView - Primary orchestrator for the episode management screen
 *
 * Fetches episode metadata, transcripts, audio versions, guest assignments,
 * and coordinates podcast generation workflow interactions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer } from '../audio/useAudioPlayer';
import { ProgressOverlay } from '../components/ProgressOverlay';
import { VersionSelector, VersionOption } from '../components/VersionSelector';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import { TranscriptEditor, TranscriptVersion } from './TranscriptEditor';
import { GuestManager, GuestProfile } from './GuestManager';
import { EpisodeChat } from './EpisodeChat';

/**
 * Episode shape returned by the API
 */
interface Episode {
  id: string;
  title: string;
  description: string | null;
  status?: StatusVariant;
  created_at: number;
}

/**
 * Audio version metadata
 */
interface AudioVersion {
  id: string;
  transcript_id: string;
  version: number;
  r2_key: string;
  r2_url: string;
  status: 'generating' | 'ready' | 'failed';
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  created_at: number;
}

/**
 * Episode workflow state returned from the Durable Object proxy endpoint
 */
interface WorkflowStatus {
  status: 'idle' | 'generating_transcript' | 'generating_audio' | 'completed' | 'failed';
  currentStep?: string | null;
  progress?: number;
  error?: string | null;
  result?: {
    transcriptId?: string;
    transcriptVersion?: number;
    audioVersionId?: string;
  } | null;
}

/**
 * Props for EpisodeView
 */
export interface EpisodeViewProps {
  episodeId: string;
}

/**
 * Helper to load JSON with standard error handling
 */
async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload.data as T;
}

/**
 * Episode view component
 */
export function EpisodeView({ episodeId }: EpisodeViewProps): JSX.Element {
  const audioPlayer = useAudioPlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptVersion[]>([]);
  const [audioVersions, setAudioVersions] = useState<AudioVersion[]>([]);
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [availableGuests, setAvailableGuests] = useState<GuestProfile[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState<{ visible: boolean; step: string; progress: number }>({
    visible: false,
    step: '',
    progress: 0,
  });
  const pollCancelRef = useRef<() => void>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshAll();
    return () => {
      pollCancelRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  useEffect(() => {
    if (transcripts.length > 0 && !selectedTranscriptId) {
      setSelectedTranscriptId(transcripts[0].id);
    }
  }, [transcripts, selectedTranscriptId]);

  useEffect(() => {
    if (audioVersions.length > 0 && !selectedAudioId) {
      setSelectedAudioId(audioVersions[0].id);
    }
  }, [audioVersions, selectedAudioId]);

  const selectedTranscript = useMemo(
    () => transcripts.find((item) => item.id === selectedTranscriptId) ?? null,
    [transcripts, selectedTranscriptId]
  );

  const selectedAudio = useMemo(
    () => audioVersions.find((item) => item.id === selectedAudioId) ?? null,
    [audioVersions, selectedAudioId]
  );

  const transcriptOptions: VersionOption[] = transcripts.map((item) => ({
    value: item.id,
    label: `Version ${item.version}`,
    description: `${new Date(item.created_at).toLocaleString()} · ${item.word_count ?? 0} words`,
  }));

  const audioOptions: VersionOption[] = audioVersions.map((item) => ({
    value: item.id,
    label: `Audio v${item.version} (${item.status})`,
    description: `${new Date(item.created_at).toLocaleString()}`,
  }));

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [episodeData, transcriptData, audioData, guestData, availableData] = await Promise.all([
        fetchJson<Episode>(`/api/episodes/${episodeId}`),
        fetchJson<TranscriptVersion[]>(`/api/episodes/${episodeId}/transcripts`),
        fetchJson<AudioVersion[]>(`/api/episodes/${episodeId}/audio-versions`),
        fetchJson<GuestProfile[]>(`/api/episodes/${episodeId}/guests`),
        fetchJson<GuestProfile[]>(`/api/guest-profiles`),
      ]);
      setEpisode(episodeData);
      setTranscripts(transcriptData.sort((a, b) => b.version - a.version));
      setAudioVersions(audioData.sort((a, b) => b.version - a.version));
      setGuests(guestData);
      setAvailableGuests(availableData);
    } catch (refreshError) {
      console.error('Failed to load episode view:', refreshError);
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load episode');
    } finally {
      setLoading(false);
    }
  };

  const startWorkflowPolling = () => {
    pollCancelRef.current?.();
    let active = true;

    const poll = async () => {
      try {
        const statusPayload = await fetch(`/api/episodes/${episodeId}/workflow-status`);
        const statusData = await statusPayload.json();
        if (statusData.success) {
          const state = statusData.data as WorkflowStatus;
          setOverlay({
            visible: true,
            step: state.currentStep ?? 'Processing…',
            progress: state.progress ?? 0,
          });

          if (!active) {
            return;
          }

          if (state.status === 'completed' || state.status === 'failed') {
            active = false;
            pollCancelRef.current?.();
            pollCancelRef.current = undefined;
            setOverlay((prev) => ({ ...prev, visible: false }));
            if (state.status === 'failed' && state.error) {
              setError(state.error);
            }
          }
        }
      } catch (statusError) {
        console.error('Failed to poll workflow status:', statusError);
      }
    };

    void poll();
    const interval = setInterval(poll, 2500);
    pollCancelRef.current = () => {
      active = false;
      clearInterval(interval);
    };
  };

  const handleGenerate = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    setOverlay({ visible: true, step: 'Starting workflow…', progress: 5 });
    setError(null);
    startWorkflowPolling();

    try {
      const response = await fetch(`/api/episodes/${episodeId}/generate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Generation failed');
      }

      await Promise.all([loadTranscripts(), loadAudioVersions()]);
      if (payload.data?.audio?.r2Url) {
        setSelectedAudioId(payload.data.audioVersionId ?? null);
        audioPlayer.playEpisode({
          episodeId,
          episodeTitle: episode?.title ?? 'Generated episode',
          audioUrl: payload.data.audio.r2Url,
          version: payload.data.transcriptVersion ?? 1,
        });
      }
    } catch (generationError) {
      console.error('Podcast generation failed:', generationError);
      setError(generationError instanceof Error ? generationError.message : 'Generation failed');
    } finally {
      pollCancelRef.current?.();
      pollCancelRef.current = undefined;
      setOverlay((prev) => ({ ...prev, visible: false }));
    }
  };

  const loadTranscripts = async () => {
    const data = await fetchJson<TranscriptVersion[]>(`/api/episodes/${episodeId}/transcripts`);
    const sorted = data.sort((a, b) => b.version - a.version);
    setTranscripts(sorted);
    if (sorted.length > 0) {
      setSelectedTranscriptId(sorted[0].id);
    }
  };

  const loadAudioVersions = async () => {
    const data = await fetchJson<AudioVersion[]>(`/api/episodes/${episodeId}/audio-versions`);
    const sorted = data.sort((a, b) => b.version - a.version);
    setAudioVersions(sorted);
    if (sorted.length > 0) {
      setSelectedAudioId(sorted[0].id);
    }
  };

  const handleTranscriptAutosave = async (transcriptId: string, body: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const response = await fetch(`/api/episodes/${episodeId}/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Autosave failed');
    }
    const updated: TranscriptVersion = payload.data;
    setTranscripts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => b.version - a.version)
    );
    return updated;
  };

  const handleCreateTranscriptVersion = async (body: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const response = await fetch(`/api/episodes/${episodeId}/transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Failed to create version');
    }
    const created: TranscriptVersion = payload.data;
    setTranscripts((prev) => [created, ...prev].sort((a, b) => b.version - a.version));
    setSelectedTranscriptId(created.id);
    return created;
  };

  const handleAddGuest = async (guestId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    await fetchJson(`/api/episodes/${episodeId}/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ guestProfileId: guestId }),
    });
    const updatedGuests = await fetchJson<GuestProfile[]>(`/api/episodes/${episodeId}/guests`);
    setGuests(updatedGuests);
  };

  const handleRemoveGuest = async (guestId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    await fetch(`/api/episodes/${episodeId}/guests/${guestId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const updatedGuests = await fetchJson<GuestProfile[]>(`/api/episodes/${episodeId}/guests`);
    setGuests(updatedGuests);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading episode…</div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800">Episode not found</h2>
          <p className="mt-2 text-gray-500">The requested episode could not be located.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProgressOverlay isVisible={overlay.visible} step={overlay.step} progress={overlay.progress} />
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{episode.title}</h1>
              {episode.description && <p className="text-gray-600">{episode.description}</p>}
            </div>
            {episode.status && <StatusBadge status={episode.status} />}
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Podcast Generation</h2>
                  <p className="text-sm text-gray-500">
                    Generate an AI-powered transcript and audio demo for this episode.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Generate Demo Podcast
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <VersionSelector
                  id="transcript-version"
                  label="Transcript version"
                  options={transcriptOptions}
                  value={selectedTranscriptId}
                  onChange={setSelectedTranscriptId}
                />
                <VersionSelector
                  id="audio-version"
                  label="Audio version"
                  options={audioOptions}
                  value={selectedAudioId}
                  onChange={(value) => {
                    setSelectedAudioId(value);
                    const chosen = audioVersions.find((item) => item.id === value);
                    if (chosen && chosen.status === 'ready') {
                      audioPlayer.playEpisode({
                        episodeId,
                        episodeTitle: episode.title,
                        audioUrl: chosen.r2_url,
                        version: chosen.version,
                      });
                    }
                  }}
                />
              </div>
              {selectedAudio && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
                  <p>Public URL: <a className="text-indigo-600 underline" href={selectedAudio.r2_url} target="_blank" rel="noreferrer">{selectedAudio.r2_url}</a></p>
                  <p className="mt-1">Duration: {selectedAudio.duration_seconds ?? 0}s · Size: {selectedAudio.file_size_bytes ?? 0} bytes</p>
                  <p className="mt-1">Status: {selectedAudio.status}</p>
                </div>
              )}
            </div>

            <TranscriptEditor
              transcript={selectedTranscript}
              loading={loading}
              onAutosave={handleTranscriptAutosave}
              onCreateVersion={handleCreateTranscriptVersion}
            />
          </div>

          <div className="space-y-6">
            <GuestManager
              assigned={guests}
              available={availableGuests}
              loading={loading}
              onAdd={handleAddGuest}
              onRemove={handleRemoveGuest}
            />
            <EpisodeChat episodeId={episodeId} episodeTitle={episode.title} />
          </div>
        </div>
      </div>
    </div>
  );
}
