/**
 * GuestManager - Manage guests assigned to an episode
 *
 * Provides UI for reviewing existing guests, removing them, and adding new
 * guest profiles sourced from the shared guest directory.
 */

import React, { useMemo, useState } from 'react';

/**
 * Guest profile shape
 */
export interface GuestProfile {
  id: string;
  name: string;
  persona_description: string;
  expertise?: string | null;
  tone?: string | null;
}

/**
 * Props for GuestManager
 */
export interface GuestManagerProps {
  assigned: GuestProfile[];
  available: GuestProfile[];
  loading: boolean;
  onAdd: (guestId: string) => Promise<void>;
  onRemove: (guestId: string) => Promise<void>;
}

/**
 * Guest management component
 */
export function GuestManager({ assigned, available, loading, onAdd, onRemove }: GuestManagerProps): JSX.Element {
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const addableGuests = useMemo(() => {
    const assignedIds = new Set(assigned.map((guest) => guest.id));
    return available.filter((guest) => !assignedIds.has(guest.id));
  }, [assigned, available]);

  const handleAddGuest = async () => {
    if (!selectedGuestId) {
      return;
    }

    try {
      setSubmitting(true);
      await onAdd(selectedGuestId);
      setSelectedGuestId('');
    } catch (error) {
      console.error('Failed to add guest:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Assigned Guests</h2>
        <span className="text-sm text-gray-500">{assigned.length} guest(s)</span>
      </header>

      <div className="space-y-3">
        {loading && <div className="text-sm text-gray-500">Loading guests…</div>}
        {!loading && assigned.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            No guests assigned yet.
          </div>
        )}

        {assigned.map((guest) => (
          <div key={guest.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-semibold text-gray-900">{guest.name}</p>
              <p className="text-sm text-gray-600">{guest.persona_description}</p>
              {(guest.expertise || guest.tone) && (
                <p className="mt-1 text-xs text-gray-500">
                  {[guest.expertise, guest.tone].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(guest.id)}
              className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700">Add guest</h3>
        <p className="mt-1 text-xs text-gray-500">
          Choose from existing guest profiles or create new ones in the guest directory.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedGuestId}
            onChange={(event) => setSelectedGuestId(event.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">Select guest profile…</option>
            {addableGuests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddGuest}
            disabled={!selectedGuestId || submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add Guest
          </button>
        </div>
      </div>
    </div>
  );
}
