/**
 * EpisodePage - Detailed episode view with transcript, guests, and audio generation
 *
 * @module pages/EpisodePage
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

interface Episode {
  id: string;
  title: string;
  description: string | null;
}

interface GuestProfile {
  id: string;
  name: string;
  persona_description: string;
}

export default function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const { play } = useAudioPlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadEpisode(id);
      loadGuests(id);
    }
  }, [id]);

  const loadEpisode = async (episodeId: string) => {
    try {
      const res = await fetch(`/api/episodes/${episodeId}`);
      const data = await res.json();

      if (data.success) {
        setEpisode(data.data);
      }
    } catch (error) {
      console.error('Error loading episode:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGuests = async (episodeId: string) => {
    try {
      const res = await fetch(`/api/episodes/${episodeId}/guests`);
      const data = await res.json();

      if (data.success) {
        setGuests(data.data || []);
      }
    } catch (error) {
      console.error('Error loading guests:', error);
    }
  };

  const generatePodcast = async () => {
    if (!id) return;

    setGenerating(true);
    try {
      const res = await fetch(`/api/episodes/${id}/generate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
        },
      });
      const data = await res.json();

      if (data.success) {
        alert('Podcast generation started! This may take a few minutes.');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error generating podcast:', error);
      alert('Failed to start podcast generation');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading episode...</div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Episode Not Found</h2>
          <a href="/episodes" className="btn-primary">
            Back to Episodes
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{episode.title}</h1>
          {episode.description && (
            <p className="text-gray-600">{episode.description}</p>
          )}
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Podcast Generation</h2>
              <p className="text-gray-600 mb-4">
                Generate an AI-powered podcast with multiple guests.
                Ensure guests are assigned below before generating.
              </p>
              <button
                onClick={generatePodcast}
                disabled={generating || guests.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Podcast Demo'}
              </button>
              {guests.length === 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Please assign at least one guest to generate a podcast.
                </p>
              )}
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4">Transcript</h2>
              <p className="text-gray-500">
                Transcript will appear here after podcast generation.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-bold mb-4">Assigned Guests</h2>
              {guests.length === 0 ? (
                <p className="text-gray-500 text-sm">No guests assigned yet.</p>
              ) : (
                <ul className="space-y-2">
                  {guests.map((guest) => (
                    <li key={guest.id} className="p-2 bg-gray-50 rounded">
                      <div className="font-medium">{guest.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {guest.persona_description}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-bold mb-4">Audio Versions</h2>
              <p className="text-gray-500 text-sm">
                Audio versions will appear here after generation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
