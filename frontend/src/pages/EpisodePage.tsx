/**
 * EpisodePage - Wrapper around the EpisodeView orchestrator
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { EpisodeView } from '../ui/episodes/EpisodeView';

export default function EpisodePage(): JSX.Element | null {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <EpisodeView episodeId={id} />;
}
