/**
 * BrainstormPage - AI-powered brainstorm chat interface
 *
 * @module pages/BrainstormPage
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

export default function BrainstormPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState(threadId);

  // Load messages if threadId exists
  useEffect(() => {
    if (currentThreadId) {
      loadMessages(currentThreadId);
    }
  }, [currentThreadId]);

  const loadMessages = async (tid: string) => {
    try {
      const res = await fetch(`/api/threads/${tid}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewThread = async () => {
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Brainstorm Session' }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentThreadId(data.data.id);
        navigate(`/brainstorm/${data.data.id}`);
      }
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    if (!currentThreadId) {
      await createNewThread();
      return;
    }

    const userMessage = input;
    setInput('');
    setLoading(true);

    // Optimistically add user message
    setMessages((prev) => [
      ...prev,
      {
        id: 'temp',
        role: 'user',
        content: userMessage,
        created_at: Date.now(),
      },
    ]);

    try {
      const res = await fetch(`/api/brainstorm/${currentThreadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();

      if (data.success) {
        // Reload all messages to get fresh data
        await loadMessages(currentThreadId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Brainstorm Chat</h1>
          <p className="text-gray-600">
            Collaborate with AI to develop podcast ideas and explore topics
          </p>
        </header>

        {!currentThreadId && (
          <div className="card text-center mb-8">
            <button onClick={createNewThread} className="btn-primary">
              Start New Brainstorm Session
            </button>
          </div>
        )}

        {currentThreadId && (
          <>
            <div className="card mb-4 min-h-[400px] max-h-[600px] overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Start the conversation by sending a message below
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-4 ${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="text-left">
                  <div className="inline-block max-w-[80%] p-3 rounded-lg bg-gray-200">
                    <div className="text-sm text-gray-500">AI is thinking...</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
