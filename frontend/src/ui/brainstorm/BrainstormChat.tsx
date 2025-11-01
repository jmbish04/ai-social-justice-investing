/**
 * BrainstormChat - Reusable brainstorming chat surface
 *
 * Handles thread creation, message streaming (non-streaming fallback), and
 * supports promoting ideas to new episodes via the API.
 * Now includes thread history sidebar and voice input support.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

interface Thread {
  id: string;
  title: string | null;
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
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load threads for sidebar
  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (initialThreadId) {
      setThreadId(initialThreadId);
      void loadMessages(initialThreadId);
    }
  }, [initialThreadId]);

  const loadThreads = async () => {
    try {
      const response = await fetch('/api/threads?limit=50');
      const data = await response.json();
      if (data.success) {
        setThreads(data.data);
      }
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

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
        await loadThreads(); // Refresh thread list
        navigate(`/brainstorm/${data.data.id}`);
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

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) {
      return;
    }

    let activeThreadId = threadId;
    if (!activeThreadId) {
      activeThreadId = await createThread();
    }

    if (!activeThreadId) {
      return;
    }

    const userText = messageText;
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
      } else {
        // Show error in chat
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `❌ Error: ${data.error || 'Failed to get response'}`,
            created_at: Date.now(),
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to send brainstorm message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ Network error. Please check your connection and try again.`,
          created_at: Date.now(),
        },
      ]);
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

  const switchThread = (id: string) => {
    setThreadId(id);
    loadMessages(id);
    navigate(`/brainstorm/${id}`);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    // For now, show a message that transcription would happen here
    // In production, you'd send this to a speech-to-text API
    console.log('Audio recorded, size:', audioBlob.size);
    setInput('[Voice message - transcription not yet implemented]');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={createThread}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + New Session
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => switchThread(thread.id)}
                className={`w-full text-left rounded-lg px-3 py-2 mb-1 text-sm transition-colors ${
                  thread.id === threadId
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="truncate">
                  {thread.title || 'Brainstorm Session'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(thread.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold">Brainstorm Studio</h1>
              <p className="text-sm text-gray-500">
                Collaborate with AI to develop podcast episode ideas
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !threadId && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start a New Conversation
              </h3>
              <p className="text-gray-600">
                Type a message or use voice input to begin brainstorming
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-3 shadow ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : message.content.startsWith('❌')
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`mt-2 text-xs ${message.role === 'user' ? 'text-indigo-100' : 'text-gray-500'}`}>
                  {new Date(message.created_at).toLocaleTimeString()}
                </div>
                {message.role === 'assistant' && !message.content.startsWith('❌') && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => promoteToEpisode(message)}
                      className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      → Promote to Episode
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg px-4 py-3 shadow border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-500">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading}
              className={`flex-shrink-0 rounded-lg p-3 text-white font-medium transition-colors ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-gray-600 hover:bg-gray-700'
              } disabled:opacity-50`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder={isRecording ? 'Recording...' : threadId ? 'Type your message or use voice input...' : 'Start a session to chat...'}
              disabled={loading || isRecording}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || isRecording}
              className="flex-shrink-0 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
