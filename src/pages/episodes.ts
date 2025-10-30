import { layout } from './layout';
import { Episode } from '../types/bindings';

export function episodesPage(episodes: Episode[]): string {
  const episodeCards = episodes.map(ep => {
    const statusColors = {
      planned: 'bg-blue-100 text-blue-800',
      recorded: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800'
    };

    return `
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between mb-3">
          <h3 class="text-xl font-semibold text-gray-900 flex-1">
            ${ep.title}
          </h3>
          <span class="ml-4 px-3 py-1 rounded-full text-xs font-medium ${statusColors[ep.status]}">
            ${ep.status.charAt(0).toUpperCase() + ep.status.slice(1)}
          </span>
        </div>
        <p class="text-gray-600 mb-4 leading-relaxed">
          ${ep.description}
        </p>
        <div class="flex items-center text-sm text-gray-500 space-x-4">
          <div class="flex items-center">
            <span class="font-medium mr-1">Guest:</span>
            <span>${ep.guest}</span>
          </div>
          ${ep.dateCreated ? `
            <div class="flex items-center">
              <span class="font-medium mr-1">Created:</span>
              <span>${new Date(ep.dateCreated).toLocaleDateString()}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <div>
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-3">Podcast Episodes</h1>
        <p class="text-lg text-gray-600">
          Upcoming and published episodes exploring AI, ethics, and social investing
        </p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div class="bg-blue-50 overflow-hidden rounded-lg px-4 py-5 border border-blue-200">
          <dt class="truncate text-sm font-medium text-blue-900">Planned</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-blue-600">
            ${episodes.filter(e => e.status === 'planned').length}
          </dd>
        </div>
        <div class="bg-yellow-50 overflow-hidden rounded-lg px-4 py-5 border border-yellow-200">
          <dt class="truncate text-sm font-medium text-yellow-900">Recorded</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-yellow-600">
            ${episodes.filter(e => e.status === 'recorded').length}
          </dd>
        </div>
        <div class="bg-green-50 overflow-hidden rounded-lg px-4 py-5 border border-green-200">
          <dt class="truncate text-sm font-medium text-green-900">Published</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            ${episodes.filter(e => e.status === 'published').length}
          </dd>
        </div>
      </div>

      <!-- Episodes List -->
      <div class="space-y-6">
        ${episodeCards}
      </div>

      ${episodes.length === 0 ? `
        <div class="text-center py-12">
          <p class="text-gray-500">No episodes found. Check back soon!</p>
        </div>
      ` : ''}
    </div>

    <script>
      // Client-side filtering could be added here
      console.log('Episodes page loaded');
    </script>
  `;

  return layout('Episodes', content, 'episodes');
}
