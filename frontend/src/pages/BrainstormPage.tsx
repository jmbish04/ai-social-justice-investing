/**
 * BrainstormPage - Shell that embeds the BrainstormChat component
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BrainstormChat } from '../ui/brainstorm/BrainstormChat';
import { Navbar } from '../ui/components/Navbar';

export default function BrainstormPage(): JSX.Element {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <BrainstormChat
          initialThreadId={threadId}
          onPromote={(episodeId) => navigate(`/episodes/${episodeId}`)}
        />
      </div>
    </div>
  );
}
