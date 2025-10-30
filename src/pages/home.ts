import { layout } from './layout';

export function homePage(): string {
  const content = `
    <div class="text-center">
      <!-- Hero Section -->
      <div class="mb-16">
        <h1 class="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl mb-6">
          Where <span class="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI meets</span><br/>
          Social Justice Investing
        </h1>
        <p class="mt-6 text-lg leading-8 text-gray-600 max-w-3xl mx-auto">
          A research and planning workspace for a podcast exploring the intersection of
          artificial intelligence, algorithmic ethics, and socially responsible investing.
        </p>
      </div>

      <!-- Features Grid -->
      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 mt-12">
        <!-- Episodes Card -->
        <a href="/episodes" class="group relative bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-primary">
          <div class="text-4xl mb-4">🎙️</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Episodes</h3>
          <p class="text-sm text-gray-600">
            Explore upcoming podcast topics on AI ethics and justice
          </p>
        </a>

        <!-- Research Card -->
        <a href="/research" class="group relative bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-primary">
          <div class="text-4xl mb-4">🔬</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Research</h3>
          <p class="text-sm text-gray-600">
            Browse Gemini Deep Research insights on AI and equity
          </p>
        </a>

        <!-- Pairings Card -->
        <a href="/pairings" class="group relative bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-primary">
          <div class="text-4xl mb-4">🤝</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Pairings</h3>
          <p class="text-sm text-gray-600">
            See matched guest-author chemistry and topics
          </p>
        </a>

        <!-- Submit Card -->
        <a href="/submit" class="group relative bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-primary">
          <div class="text-4xl mb-4">✍️</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Submit</h3>
          <p class="text-sm text-gray-600">
            Share your ideas for episodes or research
          </p>
        </a>
      </div>

      <!-- About Section -->
      <div class="mt-20 max-w-4xl mx-auto text-left">
        <h2 class="text-3xl font-bold text-gray-900 mb-6">About the Project</h2>
        <div class="prose prose-lg text-gray-600 space-y-4">
          <p>
            <strong>Social Justice x AI</strong> is a podcast project that investigates how artificial
            intelligence intersects with social justice investing, financial equity, and algorithmic accountability.
          </p>
          <p>
            Drawing on insights from <em>The Social Justice Investor</em> and cutting-edge AI research,
            we pair impact investors, AI ethicists, and technologists to explore:
          </p>
          <ul class="list-disc pl-6 space-y-2">
            <li>How algorithmic bias perpetuates financial inequality</li>
            <li>Using AI to democratize access to capital</li>
            <li>Fairness audits for credit scoring and lending systems</li>
            <li>Data colonialism in emerging markets</li>
            <li>Building tools that center equity, not extraction</li>
          </ul>
          <p class="mt-6">
            This dashboard serves as our public-facing research hub and private planning workspace,
            powered by Cloudflare Workers and enriched by Gemini Deep Research outputs.
          </p>
        </div>
      </div>
    </div>
  `;

  return layout('Home', content, 'home');
}
