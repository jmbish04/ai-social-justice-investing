/**
 * HomePage - Landing page for the application
 *
 * @module pages/HomePage
 */

import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            The Social Justice Investor
          </h1>
          <p className="text-xl text-gray-600">
            AI-powered podcast platform exploring finance, technology, and equity
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Link
            to="/brainstorm"
            className="card hover:shadow-xl transition-shadow cursor-pointer"
          >
            <h2 className="text-2xl font-bold mb-4">💡 Brainstorm</h2>
            <p className="text-gray-600">
              Start a conversation with AI to develop podcast ideas, explore topics,
              and refine your thoughts on social justice and technology.
            </p>
          </Link>

          <Link
            to="/episodes"
            className="card hover:shadow-xl transition-shadow cursor-pointer"
          >
            <h2 className="text-2xl font-bold mb-4">🎙️ Episodes</h2>
            <p className="text-gray-600">
              Browse episodes, manage transcripts, assign guests, and generate
              AI-powered podcast demos with multiple participants.
            </p>
          </Link>
        </div>

        <div className="card text-center">
          <h3 className="text-xl font-semibold mb-4">About This Platform</h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            This platform uses Cloudflare Workers AI, D1, R2, and the Agent SDK
            to create a fully AI-powered podcast production workflow. Features include
            brainstorm chat, multi-guest conversation generation, and automated
            transcript and audio creation.
          </p>
        </div>
      </div>
    </div>
  );
}
