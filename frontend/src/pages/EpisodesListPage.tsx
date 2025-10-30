/**
 * EpisodesListPage - List all podcast episodes
 *
 * @module pages/EpisodesListPage
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, StatusVariant } from '../ui/components/StatusBadge';

interface Episode {
  id: string;
  title: string;
  description: string | null;
  created_at: number;
  status?: StatusVariant;
}

export default function EpisodesListPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    try {
      const res = await fetch('/api/episodes');
      const data = await res.json();

      if (data.success) {
        // Merge static episodes data with D1 episodes if available
        setEpisodes(data.data || []);
      }
    } catch (error) {
      console.error('Error loading episodes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading episodes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Podcast Episodes</h1>
          <p className="text-gray-600">
            Manage episodes, transcripts, guests, and generate AI podcasts
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {episodes.map((episode) => (
            <Link
              key={episode.id}
              to={`/episodes/${episode.id}`}
              className="card hover:shadow-xl transition-shadow"
            >
              <h3 className="text-xl font-semibold mb-2">{episode.title}</h3>
              {episode.description && (
                <p className="text-gray-600 text-sm line-clamp-3">
                  {episode.description}
                </p>
              )}
              <div className="mt-3">
                {episode.status && <StatusBadge status={episode.status} />}
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Created: {new Date(episode.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}

          {episodes.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No episodes found. Check back soon!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
