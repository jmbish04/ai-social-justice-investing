/**
 * StatusBadge - Colored badge representing entity status
 *
 * Used across idea and episode listings to convey workflow status in a
 * consistent visual style.
 */

import React from 'react';

/**
 * Supported status variants
 */
export type StatusVariant = 'draft' | 'planned' | 'in_progress' | 'recorded' | 'published' | 'error';

/**
 * Props for StatusBadge
 */
export interface StatusBadgeProps {
  status: StatusVariant;
}

/**
 * Map status to Tailwind color tokens
 */
function getStatusClasses(status: StatusVariant): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700';
    case 'planned':
      return 'bg-blue-100 text-blue-700';
    case 'in_progress':
      return 'bg-amber-100 text-amber-700';
    case 'recorded':
      return 'bg-indigo-100 text-indigo-700';
    case 'published':
      return 'bg-emerald-100 text-emerald-700';
    case 'error':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Render a status badge with consistent styling
 */
export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const classes = getStatusClasses(status);
  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  );
}
