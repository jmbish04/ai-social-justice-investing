import { layout } from './layout';

export function submitPage(): string {
  const content = `
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-3">Submit an Idea</h1>
        <p class="text-lg text-gray-600">
          Share your thoughts on potential podcast episodes, research directions, or guest suggestions
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <form id="submitForm" class="space-y-6">
          <!-- Type Selection -->
          <div>
            <label for="ideaType" class="block text-sm font-medium text-gray-700 mb-2">
              Idea Type
            </label>
            <select id="ideaType" name="type" required class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border">
              <option value="episode">Episode Idea</option>
              <option value="research">Research Suggestion</option>
              <option value="general">General Feedback</option>
            </select>
          </div>

          <!-- Content Textarea -->
          <div>
            <label for="ideaContent" class="block text-sm font-medium text-gray-700 mb-2">
              Your Idea (Markdown supported)
            </label>
            <textarea
              id="ideaContent"
              name="content"
              rows="12"
              required
              placeholder="# Your Idea Title

## Description
Write your idea here. You can use Markdown formatting!

- Bullet points
- **Bold text**
- *Italic text*
- [Links](https://example.com)

## Why This Matters
Explain the impact and relevance..."
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border font-mono"
            ></textarea>
            <p class="mt-2 text-sm text-gray-500">
              Use Markdown syntax for formatting. Your submission will be saved for review.
            </p>
          </div>


          <!-- Submit Button -->
          <div class="flex items-center justify-between">
            <button
              type="submit"
              id="submitButton"
              class="inline-flex justify-center rounded-md border border-transparent bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              Submit Idea
            </button>
            <button
              type="reset"
              class="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear Form
            </button>
          </div>
        </form>

        <!-- Success/Error Messages -->
        <div id="messageContainer" class="mt-6 hidden">
          <div id="successMessage" class="hidden rounded-md bg-green-50 p-4 border border-green-200">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-green-800">
                  Your idea has been submitted successfully!
                </p>
              </div>
            </div>
          </div>
          <div id="errorMessage" class="hidden rounded-md bg-red-50 p-4 border border-red-200">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-red-800" id="errorText">
                  An error occurred. Please try again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Markdown Guide -->
      <div class="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Markdown Quick Reference</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <code class="text-primary"># Heading 1</code>
            <br/><code class="text-primary">## Heading 2</code>
          </div>
          <div>
            <code class="text-primary">**bold**</code>
            <br/><code class="text-primary">*italic*</code>
          </div>
          <div>
            <code class="text-primary">- List item</code>
            <br/><code class="text-primary">1. Numbered item</code>
          </div>
          <div>
            <code class="text-primary">[Link](url)</code>
            <br/><code class="text-primary">\`code\`</code>
          </div>
        </div>
      </div>
    </div>

    <script>
      const form = document.getElementById('submitForm');
      const submitButton = document.getElementById('submitButton');
      const messageContainer = document.getElementById('messageContainer');
      const successMessage = document.getElementById('successMessage');
      const errorMessage = document.getElementById('errorMessage');
      const errorText = document.getElementById('errorText');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Disable submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        // Hide previous messages
        messageContainer.classList.add('hidden');
        successMessage.classList.add('hidden');
        errorMessage.classList.add('hidden');

        try {
          const formData = new FormData(form);
          const data = {
            type: formData.get('type'),
            content: formData.get('content'),
          };

          // No authentication required - public API
          const url = '/api/submit';

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            messageContainer.classList.remove('hidden');
            successMessage.classList.remove('hidden');
            form.reset();
          } else {
            throw new Error(result.error || 'Submission failed');
          }
        } catch (error) {
          console.error('Submission error:', error);
          messageContainer.classList.remove('hidden');
          errorMessage.classList.remove('hidden');
          errorText.textContent = error.message || 'An error occurred. Please try again.';
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit Idea';
        }
      });
    </script>
  `;

  return layout('Submit', content, 'submit');
}
