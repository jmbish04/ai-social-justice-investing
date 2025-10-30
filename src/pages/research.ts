import { layout } from './layout';
import { ResearchEntry } from '../types/bindings';

export function researchPage(research: ResearchEntry[]): string {
  // Get unique domains and chemistry types for filters
  const domains = [...new Set(research.map(r => r.domain))].sort();
  const chemistryTypes = [...new Set(research.map(r => r.chemistry))].sort();

  const domainOptions = domains.map(d => `<option value="${d}">${d}</option>`).join('');
  const chemistryOptions = chemistryTypes.map(c => `<option value="${c}">${c}</option>`).join('');

  const tableRows = research.map(entry => `
    <tr class="research-row hover:bg-gray-50" data-domain="${entry.domain}" data-chemistry="${entry.chemistry}">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${entry.name}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
          ${entry.domain}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
          ${entry.chemistry}
        </span>
      </td>
      <td class="px-6 py-4">
        <div class="text-sm text-gray-900">${entry.topic}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-secondary hover:underline">
          Visit →
        </a>
      </td>
    </tr>
  `).join('');

  const content = `
    <div>
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-3">Research Database</h1>
        <p class="text-lg text-gray-600">
          Gemini Deep Research insights on AI ethicists, scholars, and practitioners
        </p>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label for="domainFilter" class="block text-sm font-medium text-gray-700 mb-2">
              Domain
            </label>
            <select id="domainFilter" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border">
              <option value="">All Domains</option>
              ${domainOptions}
            </select>
          </div>
          <div>
            <label for="chemistryFilter" class="block text-sm font-medium text-gray-700 mb-2">
              Chemistry
            </label>
            <select id="chemistryFilter" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border">
              <option value="">All Types</option>
              ${chemistryOptions}
            </select>
          </div>
          <div>
            <label for="searchInput" class="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input type="text" id="searchInput" placeholder="Search by name or topic..." class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border">
          </div>
        </div>
        <div class="mt-4">
          <button id="resetFilters" class="text-sm text-primary hover:text-secondary font-medium">
            Reset Filters
          </button>
          <span id="resultCount" class="ml-4 text-sm text-gray-600">
            Showing ${research.length} results
          </span>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chemistry
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Topic
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Link
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200" id="researchTableBody">
            ${tableRows}
          </tbody>
        </table>
      </div>

      ${research.length === 0 ? `
        <div class="text-center py-12">
          <p class="text-gray-500">No research entries found.</p>
        </div>
      ` : ''}
    </div>

    <script>
      // Client-side filtering
      const domainFilter = document.getElementById('domainFilter');
      const chemistryFilter = document.getElementById('chemistryFilter');
      const searchInput = document.getElementById('searchInput');
      const resetButton = document.getElementById('resetFilters');
      const resultCount = document.getElementById('resultCount');
      const rows = document.querySelectorAll('.research-row');

      function applyFilters() {
        const domainValue = domainFilter.value.toLowerCase();
        const chemistryValue = chemistryFilter.value.toLowerCase();
        const searchValue = searchInput.value.toLowerCase();
        let visibleCount = 0;

        rows.forEach(row => {
          const domain = row.dataset.domain.toLowerCase();
          const chemistry = row.dataset.chemistry.toLowerCase();
          const text = row.textContent.toLowerCase();

          const matchesDomain = !domainValue || domain === domainValue;
          const matchesChemistry = !chemistryValue || chemistry === chemistryValue;
          const matchesSearch = !searchValue || text.includes(searchValue);

          if (matchesDomain && matchesChemistry && matchesSearch) {
            row.style.display = '';
            visibleCount++;
          } else {
            row.style.display = 'none';
          }
        });

        resultCount.textContent = \`Showing \${visibleCount} result\${visibleCount !== 1 ? 's' : ''}\`;
      }

      domainFilter.addEventListener('change', applyFilters);
      chemistryFilter.addEventListener('change', applyFilters);
      searchInput.addEventListener('input', applyFilters);

      resetButton.addEventListener('click', () => {
        domainFilter.value = '';
        chemistryFilter.value = '';
        searchInput.value = '';
        applyFilters();
      });
    </script>
  `;

  return layout('Research', content, 'research');
}
