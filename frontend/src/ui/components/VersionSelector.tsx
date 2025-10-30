/**
 * VersionSelector - Dropdown for choosing transcript/audio versions
 *
 * Provides accessible select UI with optional metadata rendering to help users
 * switch between historical transcript or audio artifacts.
 */

import React from 'react';

/**
 * Option shape for VersionSelector
 */
export interface VersionOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Props for VersionSelector
 */
export interface VersionSelectorProps {
  id: string;
  label: string;
  options: VersionOption[];
  value: string | null;
  onChange: (value: string) => void;
}

/**
 * Version selector component
 */
export function VersionSelector({ id, label, options, value, onChange }: VersionSelectorProps): JSX.Element {
  const selectedOption = options.find((option) => option.value === (value ?? ''));

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {options.length === 0 && <option value="">No versions available</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {value && selectedOption?.description && (
        <p className="text-xs text-gray-500">
          {selectedOption.description}
        </p>
      )}
    </div>
  );
}
