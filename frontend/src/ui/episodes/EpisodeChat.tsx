/**
 * EpisodeChat - Collaborative chat surface for a specific episode
 *
 * Wraps the brainstorm API endpoints to provide per-episode ideation threads.
 */

import React, { useEffect, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

const THREAD_STORAGE_PREFIX = 'sji.episodeThread.';

/**
 * Props for EpisodeChat
 */
export interface EpisodeChatProps {
  episodeId: string;
  episodeTitle: string;
}

/**
 * Episode specific chat component
 */
export function EpisodeChat({ episodeId, episodeTitle }: EpisodeChatProps): JSX.Element {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedThread = typeof window !== 'undefined'
      ? localStorage.getItem(`${THREAD_STORAGE_PREFIX}${episodeId}`)
      : null;

    if (storedThread) {
      setThreadId(storedThread);
      void loadMessages(storedThread);
    } else {
      void createThread();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const createThread = async () => {
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Episode ${episodeTitle}` }),
      });
      const data = await response.json();
      if (data.success) {
        setThreadId(data.data.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`${THREAD_STORAGE_PREFIX}${episodeId}`, data.data.id);
        }
      }
    } catch (error) {
      console.error('Failed to create episode chat thread:', error);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const response = await fetch(`/api/threads/${id}/messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.data as Message[]);
      }
    } catch (error) {
      console.error('Failed to load episode chat messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!threadId || !input.trim()) {
      return;
    }

    const userText = input.trim();
    setInput('');
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: userText,
        created_at: Date.now(),
      },
    ]);

    try {
      const response = await fetch(`/api/brainstorm/${threadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, context: { episodeId } }),
      });
      const data = await response.json();
      if (data.success) {
        await loadMessages(threadId);
      }
    } catch (error) {
      console.error('Failed to send episode chat message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card flex h-full flex-col">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Episode Chat</h2>
        <p className="text-sm text-gray-500">
          Collaborate with the AI producer to refine this episode.
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-sm text-gray-500">Start the conversation below.</div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="mt-1 text-xs opacity-70">
                {new Date(message.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-sm text-gray-500">AI is responding…</div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Ask the producer for help…"
          disabled={!threadId || loading}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!threadId || loading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
