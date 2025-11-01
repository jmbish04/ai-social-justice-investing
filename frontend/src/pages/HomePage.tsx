/**
 * HomePage - Landing page for the application
 *
 * @module pages/HomePage
 */

import React from 'react';
import { Navbar } from '../ui/components/Navbar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            The Social Justice Investor
          </h1>
          <p className="text-xl text-gray-600">
            AI-powered podcast platform exploring finance, technology, and equity
          </p>
        </header>

        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Project</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              This platform was created by a brother who wanted to support his sister's important work.
              She's passionate about social justice investing and has written the book
              <span className="font-semibold"> "The Social Justice Investor"</span>, bringing together
              financial market experts who care deeply about leveraging finance to address social injustice.
            </p>
            <p>
              In this crazy moment in time we're living through, AI is rapidly transforming our world.
              Without proper regulation, AI could exacerbate existing inequalities and create new forms
              of social injustice. This platform explores how we can proactively address these challenges
              on the horizon.
            </p>
            <p>
              The platform pairs contributors from the book—experts in financial markets and social justice—with
              diverse voices who didn't appear in the book. The goal is to create meaningful conversations
              that keep the network growing, expand the audience, and amplify the impact of these critical discussions.
            </p>
            <p>
              Ideas like Bernie Sanders' proposal to tax jobs replaced by AI are explored here, along with
              other innovative approaches to ensuring AI benefits everyone, not just a privileged few.
            </p>
          </div>
        </div>

        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div>
              <h3 className="font-semibold text-lg mb-2">1. Brainstorm Ideas</h3>
              <p>
                Use the AI-powered brainstorm studio to develop podcast episode concepts,
                explore topics, and refine ideas around social justice, AI regulation, and equitable finance.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">2. Create Episodes</h3>
              <p>
                Assign guest contributors (both book authors and diverse new voices) to episodes.
                The AI helps generate transcripts featuring meaningful conversations between the host and guests.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">3. Generate Content</h3>
              <p>
                Leverage AI to transform transcripts into podcast audio, helping save time
                and streamline the production process. Edit transcripts, manage multiple versions,
                and generate professional audio demos.
              </p>
            </div>
          </div>
        </div>

        <div className="card text-center bg-indigo-50 border-indigo-200">
          <h2 className="text-xl font-bold text-gray-900 mb-3">A Brother's Hope</h2>
          <p className="text-gray-700 max-w-2xl mx-auto">
            Even if this platform just helps with the AI transcript-to-podcast feature and shaves
            a little time from the day, it will have been worth it. But the real hope is that it
            becomes a tool for amplifying important conversations about social justice, equity,
            and building a better future for everyone.
          </p>
        </div>
      </div>
    </div>
  );
}
