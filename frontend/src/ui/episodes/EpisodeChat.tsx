/**
 * EpisodeChat - Collaborative chat surface for a specific episode
 *
 * Wraps the brainstorm API endpoints to provide per-episode ideation threads.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/threads/${id}/messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.data as Message[]);
      }
    } catch (error) {
      console.error('Failed to load episode chat messages:', error);
    }
  }, []); // setMessages is stable and doesn't need to be a dependency

  const createThread = useCallback(async () => {
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Episode ${episodeTitle}` }),
      });
      const data = await response.json();
      if (data.success) {
        const newThreadId = data.data.id;
        setThreadId(newThreadId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`${THREAD_STORAGE_PREFIX}${episodeId}`, newThreadId);
        }
        // Load messages after creating the thread
        await loadMessages(newThreadId);
      }
    } catch (error) {
      console.error('Failed to create episode chat thread:', error);
    }
  }, [episodeId, episodeTitle, loadMessages]); // setThreadId is stable

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
  }, [episodeId, createThread, loadMessages]);

  const sendMessage = async () => {
    if (!threadId || !input.trim()) {
      return;
    }

    const userText = input.trim();
    setInput('');
    setLoading(true);

    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      role: 'user' as const,
      content: userText,
      created_at: Date.now(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch(`/api/brainstorm/${threadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, context: { episodeId, episodeTitle } }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Reload messages to get the actual AI response
        await loadMessages(threadId);
      } else {
        // Show error message in chat
        const errorMsg = data.error || 'Failed to get AI response. Please try again.';
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ Failure: ${errorMsg}`,
          created_at: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error: any) {
      console.error('Failed to send episode chat message:', error);
      // Show error message in chat
      const errorMsg = error?.message || 'Unable to connect to the server. Please check your connection and try again.';
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Failure: Network error - ${errorMsg}`,
        created_at: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card flex flex-col" style={{ minHeight: '200px', maxHeight: '600px' }}>
      <header className="mb-2 flex-shrink-0">
        <h2 className="text-base font-semibold">Episode Chat</h2>
        <p className="text-xs text-gray-500">
          Collaborate with the AI producer
        </p>
      </header>

      {/* Scrollable messages container - starts small, grows with content */}
      <div 
        className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3"
        style={{ minHeight: '120px', maxHeight: '400px' }}
      >
        {messages.length === 0 && !loading && (
          <div className="text-center text-xs text-gray-400 py-4">
            Start the conversation below
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-xs shadow ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : message.content.startsWith('❌')
                  ? 'bg-red-50 text-red-800 border-2 border-red-300'
                  : 'bg-white text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap text-xs leading-relaxed">
                {message.content}
              </div>
              <div className="mt-1 text-xs opacity-60">
                {new Date(message.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {/* Thinking indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-3 py-2 shadow border border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}


        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - fixed at bottom */}
      <div className="mt-3 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Ask the producer for help…"
          disabled={!threadId || loading}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!threadId || loading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
