/**
 * BrainstormChat - Reusable brainstorming chat surface
 *
 * Handles thread creation, message streaming (non-streaming fallback), and
 * supports promoting ideas to new episodes via the API.
 */

import React, { useEffect, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

/**
 * Props for BrainstormChat
 */
export interface BrainstormChatProps {
  initialThreadId?: string | null;
  onPromote?: (episodeId: string) => void;
}

/**
 * Brainstorm chat component
 */
export function BrainstormChat({ initialThreadId, onPromote }: BrainstormChatProps): JSX.Element {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialThreadId) {
      setThreadId(initialThreadId);
      void loadMessages(initialThreadId);
    }
  }, [initialThreadId]);

  const createThread = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Brainstorm Session' }),
      });
      const data = await response.json();
      if (data.success) {
        setThreadId(data.data.id);
        await loadMessages(data.data.id);
        return data.data.id as string;
      }
    } catch (error) {
      console.error('Failed to create brainstorm thread:', error);
    }
    return null;
  };

  const loadMessages = async (id: string) => {
    try {
      const response = await fetch(`/api/threads/${id}/messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.data as Message[]);
      }
    } catch (error) {
      console.error('Failed to load brainstorm messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    let activeThreadId = threadId;
    if (!activeThreadId) {
      activeThreadId = await createThread();
    }

    if (!activeThreadId) {
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
      const response = await fetch(`/api/brainstorm/${activeThreadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });
      const data = await response.json();
      if (data.success) {
        await loadMessages(activeThreadId);
      }
    } catch (error) {
      console.error('Failed to send brainstorm message:', error);
    } finally {
      setLoading(false);
    }
  };

  const promoteToEpisode = async (message: Message) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    try {
      const response = await fetch('/api/episodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: message.content.slice(0, 80),
          description: message.content,
        }),
      });
      const data = await response.json();
      if (data.success && onPromote) {
        onPromote(data.data.id);
      }
    } catch (error) {
      console.error('Failed to promote idea to episode:', error);
    }
  };

  return (
    <div className="card flex h-full flex-col">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Brainstorm Studio</h1>
        <p className="text-sm text-gray-500">
          Collaborate with the AI assistant to refine your next episode concept.
        </p>
      </header>

      {!threadId && (
        <div className="mb-4 text-sm text-gray-600">
          Start a new brainstorm to unlock collaborative ideation.
          <button
            type="button"
            onClick={createThread}
            className="ml-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            New Session
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow ${
                message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="mt-1 text-xs opacity-70">
                {new Date(message.created_at).toLocaleTimeString()}
              </div>
              {message.role === 'assistant' && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => promoteToEpisode(message)}
                    className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Promote to Episode
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-500">AI is thinking…</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder={threadId ? 'Share an idea…' : 'Start a session to chat…'}
          disabled={loading}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
