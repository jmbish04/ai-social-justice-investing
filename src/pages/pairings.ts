import { layout } from './layout';
import { Pairing } from '../types/bindings';

export function pairingsPage(pairings: Pairing[]): string {
  const pairingCards = pairings.map(pairing => {
    const chemistryBadges = pairing.chemistry.map(tag =>
      `<span class="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">${tag}</span>`
    ).join(' ');

    const confidenceColor = (score?: number) => {
      if (!score) return 'text-gray-400';
      if (score >= 90) return 'text-green-600';
      if (score >= 80) return 'text-blue-600';
      return 'text-yellow-600';
    };

    return `
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <!-- Header with names -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-lg font-semibold text-gray-900">${pairing.guestName}</span>
              <span class="text-gray-400">↔</span>
              <span class="text-lg font-semibold text-gray-900">${pairing.authorName}</span>
            </div>
            <h3 class="text-xl font-bold text-primary">
              ${pairing.topic}
            </h3>
          </div>
          ${pairing.confidenceScore ? `
            <div class="text-right">
              <div class="text-2xl font-bold ${confidenceColor(pairing.confidenceScore)}">
                ${pairing.confidenceScore}%
              </div>
              <div class="text-xs text-gray-500">confidence</div>
            </div>
          ` : ''}
        </div>

        <!-- Chemistry tags -->
        <div class="flex flex-wrap gap-2 mb-4">
          ${chemistryBadges}
        </div>

        <!-- Reasoning -->
        <p class="text-gray-600 leading-relaxed">
          ${pairing.reasoning}
        </p>
      </div>
    `;
  }).join('');

  const avgConfidence = pairings.length > 0
    ? Math.round(pairings.reduce((sum, p) => sum + (p.confidenceScore || 0), 0) / pairings.length)
    : 0;

  const content = `
    <div>
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-3">Guest-Author Pairings</h1>
        <p class="text-lg text-gray-600">
          AI-suggested matches between podcast guests and authors from <em>The Social Justice Investor</em>
        </p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div class="bg-gradient-to-br from-primary to-secondary overflow-hidden rounded-lg px-4 py-5 shadow-sm">
          <dt class="truncate text-sm font-medium text-white opacity-90">Total Pairings</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-white">
            ${pairings.length}
          </dd>
        </div>
        <div class="bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden rounded-lg px-4 py-5 shadow-sm">
          <dt class="truncate text-sm font-medium text-white opacity-90">Avg. Confidence</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-white">
            ${avgConfidence}%
          </dd>
        </div>
        <div class="bg-gradient-to-br from-blue-500 to-cyan-500 overflow-hidden rounded-lg px-4 py-5 shadow-sm">
          <dt class="truncate text-sm font-medium text-white opacity-90">High Confidence</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-white">
            ${pairings.filter(p => (p.confidenceScore || 0) >= 90).length}
          </dd>
        </div>
      </div>

      <!-- Pairings Grid -->
      <div class="space-y-6">
        ${pairingCards}
      </div>

      ${pairings.length === 0 ? `
        <div class="text-center py-12">
          <p class="text-gray-500">No pairings found. Check back soon!</p>
        </div>
      ` : ''}

      <!-- About Chemistry Tags -->
      <div class="mt-12 bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">About Chemistry Tags</h2>
        <p class="text-sm text-gray-600 mb-4">
          Chemistry tags represent personality traits and communication styles that suggest
          strong compatibility for podcast conversations:
        </p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><strong class="text-purple-700">Visionary:</strong> Big-picture thinker</div>
          <div><strong class="text-purple-700">Critical Thinker:</strong> Analytical depth</div>
          <div><strong class="text-purple-700">Truth-Teller:</strong> Direct and fearless</div>
          <div><strong class="text-purple-700">Pragmatist:</strong> Solutions-focused</div>
          <div><strong class="text-purple-700">Storyteller:</strong> Narrative-driven</div>
          <div><strong class="text-purple-700">Systems-Level:</strong> Interconnected thinking</div>
        </div>
      </div>
    </div>
  `;

  return layout('Pairings', content, 'pairings');
}
