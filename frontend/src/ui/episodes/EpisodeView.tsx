/**
 * EpisodeView - Primary orchestrator for the episode management screen
 *
 * Fetches episode metadata, transcripts, audio versions, guest assignments,
 * and coordinates podcast generation workflow interactions.
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react'; // Added useCallback
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
  console.log('fetchJson: Fetching', input, init);
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!payload.success) {
    console.error('fetchJson: Request failed', {
      input,
      payloadError: payload.error,
    });
    throw new Error(payload.error || 'Request failed');
  }
  console.log('fetchJson: Success', { input, data: payload.data });
  return payload.data as T;
}

/**
 * Episode view component
 */
export function EpisodeView({ episodeId }: EpisodeViewProps): JSX.Element {
  console.log(`EpisodeView: Rendering component for episodeId: ${episodeId}`);
  const audioPlayer = useAudioPlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptVersion[]>([]);
  const [audioVersions, setAudioVersions] = useState<AudioVersion[]>([]);
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [availableGuests, setAvailableGuests] = useState<GuestProfile[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(
    null
  );
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState<{
    visible: boolean;
    step: string;
    progress: number;
  }>({
    visible: false,
    step: '',
    progress: 0,
  });
  const pollCancelRef = useRef<() => void>();
  const [error, setError] = useState<string | null>(null);

  // FIX: Moved refreshAll up and wrapped in useCallback
  const refreshAll = useCallback(async () => {
    console.log('refreshAll: Starting data fetch...');
    setLoading(true);
    setError(null);
    try {
      console.log(`refreshAll: Fetching all data for episodeId: ${episodeId}`);
      const [episodeData, transcriptData, audioData, guestData, availableData] =
        await Promise.all([
          fetchJson<Episode>(`/api/episodes/${episodeId}`),
          fetchJson<TranscriptVersion[]>(
            `/api/episodes/${episodeId}/transcripts`
          ),
          fetchJson<AudioVersion[]>(
            `/api/episodes/${episodeId}/audio-versions`
          ),
          fetchJson<GuestProfile[]>(`/api/episodes/${episodeId}/guests`),
          fetchJson<GuestProfile[]>(`/api/guest-profiles`),
        ]);
      console.log('refreshAll: All data fetched successfully', {
        episodeData,
        transcriptData,
        audioData,
        guestData,
        availableData,
      });
      setEpisode(episodeData);
      setTranscripts(transcriptData.sort((a, b) => b.version - a.version));
      setAudioVersions(audioData.sort((a, b) => b.version - a.version));
      setGuests(guestData);
      setAvailableGuests(availableData);
    } catch (refreshError) {
      console.error('Failed to load episode view:', refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to load episode'
      );
    } finally {
      setLoading(false);
      console.log('refreshAll: Fetch complete, loading set to false.');
    }
  }, [episodeId]); // Added episodeId dependency

  useEffect(() => {
    console.log(
      'EpisodeView: Initial mount useEffect running. Calling refreshAll.'
    );
    void refreshAll();
    return () => {
      console.log(
        'EpisodeView: Initial mount useEffect cleanup. Cancelling poll.'
      );
      pollCancelRef.current?.();
    };
  }, [refreshAll]);

  useEffect(() => {
    if (transcripts.length > 0 && !selectedTranscriptId) {
      console.log(
        `EpisodeView: Auto-selecting first transcript: ${transcripts[0].id}`
      );
      setSelectedTranscriptId(transcripts[0].id);
    }
  }, [transcripts, selectedTranscriptId]);

  useEffect(() => {
    if (audioVersions.length > 0 && !selectedAudioId) {
      console.log(
        `EpisodeView: Auto-selecting first audio version: ${audioVersions[0].id}`
      );
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
    description: `${new Date(
      item.created_at
    ).toLocaleString()} · ${item.word_count ?? 0} words`,
  }));

  const audioOptions: VersionOption[] = audioVersions.map((item) => ({
    value: item.id,
    label: `Audio v${item.version} (${item.status})`,
    description: `${new Date(item.created_at).toLocaleString()}`,
  }));

  const startWorkflowPolling = () => {
    console.log('startWorkflowPolling: Starting...');
    pollCancelRef.current?.();
    let active = true;

    const poll = async () => {
      console.log('startWorkflowPolling (poll): Polling workflow status...');
      try {
        const statusPayload = await fetch(
          `/api/episodes/${episodeId}/workflow-status`
        );
        const statusData = await statusPayload.json();
        if (statusData.success) {
          const state = statusData.data as WorkflowStatus;
          console.log('startWorkflowPolling (poll): Received status', state);
          setOverlay({
            visible: true,
            step: state.currentStep ?? 'Processing…',
            progress: state.progress ?? 0,
          });

          if (!active) {
            console.log(
              'startWorkflowPolling (poll): Polling is no longer active, ignoring status.'
            );
            return;
          }

          if (state.status === 'completed' || state.status === 'failed') {
            console.log(
              `startWorkflowPolling (poll): Workflow finished with status: ${state.status}`
            );
            active = false;
            pollCancelRef.current?.();
            pollCancelRef.current = undefined;
            setOverlay((prev) => ({ ...prev, visible: false }));
            if (state.status === 'failed' && state.error) {
              console.error(
                'startWorkflowPolling (poll): Workflow failed',
                state.error
              );
              setError(state.error);
            }
          }
        } else {
          console.warn(
            'startWorkflowPolling (poll): Fetch status was not successful',
            statusData
          );
        }
      } catch (statusError) {
        console.error('Failed to poll workflow status:', statusError);
      }
    };

    void poll();
    const interval = setInterval(poll, 2500);
    pollCancelRef.current = () => {
      console.log('startWorkflowPolling: Cancelling poll interval.');
      active = false;
      clearInterval(interval);
    };
  };

  const handleGenerate = async () => {
    console.log('handleGenerate: Starting podcast generation...');
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    setOverlay({ visible: true, step: 'Starting workflow…', progress: 5 });
    setError(null);
    console.log('handleGenerate: Starting workflow polling.');
    startWorkflowPolling();

    try {
      const response = await fetch(
        `/api/episodes/${episodeId}/generate-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const payload = await response.json();
      if (!payload.success) {
        console.error('handleGenerate: API call failed', payload.error);
        throw new Error(payload.error || 'Generation failed');
      }
      console.log('handleGenerate: API call successful', payload.data);

      await Promise.all([loadTranscripts(), loadAudioVersions()]);
      console.log('handleGenerate: Transcripts and audio versions reloaded.');
      if (payload.data?.audio?.r2Url) {
        setSelectedAudioId(payload.data.audioVersionId ?? null);
        console.log(
          `handleGenerate: Playing new audio ${payload.data.audio.r2Url}`
        );
        audioPlayer.playEpisode({
          episodeId,
          episodeTitle: episode?.title ?? 'Generated episode',
          audioUrl: payload.data.audio.r2Url,
          version: payload.data.transcriptVersion ?? 1,
        });
      }
    } catch (generationError) {
      console.error('Podcast generation failed:', generationError);
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Generation failed'
      );
    } finally {
      console.log('handleGenerate: Generation flow finished. Cancelling poll.');
      pollCancelRef.current?.();
      pollCancelRef.current = undefined;
      setOverlay((prev) => ({ ...prev, visible: false }));
    }
  };

  const loadTranscripts = async () => {
    console.log('loadTranscripts: Fetching transcripts...');
    const data = await fetchJson<TranscriptVersion[]>(
      `/api/episodes/${episodeId}/transcripts`
    );
    const sorted = data.sort((a, b) => b.version - a.version);
    setTranscripts(sorted);
    if (sorted.length > 0) {
      console.log(`loadTranscripts: Selecting transcript ${sorted[0].id}`);
      setSelectedTranscriptId(sorted[0].id);
    }
  };

  const loadAudioVersions = async () => {
    console.log('loadAudioVersions: Fetching audio versions...');
    const data = await fetchJson<AudioVersion[]>(
      `/api/episodes/${episodeId}/audio-versions`
    );
    const sorted = data.sort((a, b) => b.version - a.version);
    setAudioVersions(sorted);
    if (sorted.length > 0) {
      console.log(`loadAudioVersions: Selecting audio ${sorted[0].id}`);
      setSelectedAudioId(sorted[0].id);
    }
  };

  const handleTranscriptAutosave = async (
    transcriptId: string,
    body: string
  ) => {
    console.log(`handleTranscriptAutosave: Saving transcript ${transcriptId}...`);
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const response = await fetch(
      `/api/episodes/${episodeId}/transcripts/${transcriptId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ body }),
      }
    );
    const payload = await response.json();
    if (!payload.success) {
      console.error('handleTranscriptAutosave: Save failed', payload.error);
      throw new Error(payload.error || 'Autosave failed');
    }
    console.log('handleTranscriptAutosave: Save successful', payload.data);
    const updated: TranscriptVersion = payload.data;
    setTranscripts((prev) =>
      prev
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((a, b) => b.version - a.version)
    );
    return updated;
  };

  const handleCreateTranscriptVersion = async (body: string) => {
    console.log('handleCreateTranscriptVersion: Creating new version...');
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const response = await fetch(
      `/api/episodes/${episodeId}/transcripts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ body }),
      }
    );
    const payload = await response.json();
    if (!payload.success) {
      console.error(
        'handleCreateTranscriptVersion: Create failed',
        payload.error
      );
      throw new Error(payload.error || 'Failed to create version');
    }
    const created: TranscriptVersion = payload.data;
    console.log(
      'handleCreateTranscriptVersion: Create successful',
      created
    );
    setTranscripts((prev) =>
      [created, ...prev].sort((a, b) => b.version - a.version)
    );
    setSelectedTranscriptId(created.id);
    return created;
  };

  const handleAddGuest = async (guestId: string) => {
    console.log(`handleAddGuest: Adding guest ${guestId}`);
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    await fetchJson(`/api/episodes/${episodeId}/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ guestProfileId: guestId }),
    });
    console.log(`handleAddGuest: Refetching guests...`);
    const updatedGuests = await fetchJson<GuestProfile[]>(
      `/api/episodes/${episodeId}/guests`
    );
    setGuests(updatedGuests);
  };

  const handleRemoveGuest = async (guestId: string) => {
    console.log(`handleRemoveGuest: Removing guest ${guestId}`);
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    await fetch(`/api/episodes/${episodeId}/guests/${guestId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    console.log(`handleRemoveGuest: Refetching guests...`);
    const updatedGuests = await fetchJson<GuestProfile[]>(
      `/api/episodes/${episodeId}/guests`
    );
    setGuests(updatedGuests);
  };

  if (loading) {
    console.log('EpisodeView: Rendering loading state.');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading episode…</div>
      </div>
    );
  }

  if (!episode) {
    console.log('EpisodeView: Rendering episode not found state.');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800">
            Episode not found
          </h2>
          <p className="mt-2 text-gray-500">
            The requested episode could not be located.
          </p>
        </div>
      </div>
    );
  }

  console.log('EpisodeView: Rendering main view', {
    episode,
    selectedTranscriptId,
    selectedAudioId,
    error,
  });
  return (
    <div className="min-h-screen bg-gray-50">
      <ProgressOverlay
        isVisible={overlay.visible}
        step={overlay.step}
        progress={overlay.progress}
      />
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {episode.title}
              </h1>
              {episode.description && (
                <p className="text-gray-600">{episode.description}</p>
              )}
            </div>
            {episode.status && <StatusBadge status={episode.status} />}
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Podcast Generation</h2>
                  <p className="text-sm text-gray-500">
                    Generate an AI-powered transcript and audio demo for this
                    episode.
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
                    console.log(`EpisodeView: Audio version changed to ${value}`);
                    setSelectedAudioId(value);
                    const chosen = audioVersions.find(
                      (item) => item.id === value
                    );
                    if (chosen && chosen.status === 'ready') {
                      console.log(
                        `EpisodeView: Playing audio for version ${value}`,
                        chosen.r2_url
                      );
                      audioPlayer.playEpisode({
                        episodeId,
                        episodeTitle: episode.title,
                        audioUrl: chosen.r2_url,
                        version: chosen.version,
                      });
                    } else if (chosen) {
                      console.log(
                        `EpisodeView: Selected audio version not ready (status: ${chosen.status})`
                      );
                    }
                  }}
                />
              </div>
              {selectedAudio && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
                  <p>
                    Public URL:{' '}
                    <a
                      className="text-indigo-600 underline"
                      href={selectedAudio.r2_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedAudio.r2_url}
                    </a>
                  </p>
                  <p className="mt-1">
                    Duration: {selectedAudio.duration_seconds ?? 0}s · Size:{' '}
                    {selectedAudio.file_size_bytes ?? 0} bytes
                  </p>
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
