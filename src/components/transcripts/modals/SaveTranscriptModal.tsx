// src/components/transcripts/modals/SaveTranscriptModal.tsx
/*
Summary:
SaveTranscriptModal renders a simple modal dialog that lets the user provide a name
for a transcript and save it. The component manages a local title state, resets the
title to `initialTitle` whenever the modal opens, validates that the title is not
empty, and delegates persistence to the provided `onSave` callback. After a successful
save invocation the modal calls `onClose` to dismiss itself.

Imports to:
- This component is imported by pages and components that need a prompt for naming
  and saving transcripts (for example: src/app/transcripts/page.tsx and the chat page).

Exports:
- Named export: SaveTranscriptModal (React component)

Exports used by:
- src/app/transcripts/page.tsx (uses the modal to capture a title when saving a transcript)
- src/app/chat/page.tsx (used when saving the current chat transcript)

Nuances:
- The component is presentational: it validates only that the title is non-empty and
  calls `onSave`. Actual persistence and error handling are the responsibility of the
  caller.
- The `initialTitle` prop is applied when the modal opens; local state is reset every
  time `open` becomes true.
- When `open` is false the component returns null to avoid rendering any markup.
*/

import { useState, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  initialTitle?: string;
};

/**
 * SaveTranscriptModal
 *
 * Renders a modal UI for entering a transcript title and saving it.
 *
 * Responsibilities:
 * - Maintain local input state for the transcript title.
 * - Reset the input to `initialTitle` whenever the modal opens.
 * - Ensure the title is non-empty before calling `onSave`.
 * - Call `onClose` after invoking `onSave`.
 *
 * Props:
 * - open: controls visibility. When false the component returns null.
 * - onClose: callback to dismiss the modal.
 * - onSave: callback invoked with the title when the user saves.
 * - initialTitle: optional initial title applied when the modal opens.
 */
export function SaveTranscriptModal({
  open,
  onClose,
  onSave,
  initialTitle = "",
}: Props) {
  const [title, setTitle] = useState(initialTitle);

  /**
   * handleSave
   *
   * Validate and forward the title to the caller, then close the modal.
   * The modal enforces a non-empty trimmed title; persistence and further
   * validation are left to the `onSave` implementation.
   */
  const handleSave = () => {
    if (title.trim()) {
      onSave(title);
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
    }
  }, [open, initialTitle]);

  if (!open) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{
          backgroundColor: "rgb(var(--background))",
          color: "rgb(var(--foreground))",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Save Transcript</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter transcript name"
          maxLength={150}
          className="mb-4 w-full rounded border p-2"
          style={{
            backgroundColor: "rgb(var(--input-bg))",
            color: "rgb(var(--foreground))",
            borderColor: "rgba(var(--secondary), 0.2)",
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-4 py-2"
            style={{
              backgroundColor: "rgba(var(--secondary), 0.1)",
              color: "rgb(var(--foreground))",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded px-4 py-2 disabled:opacity-50"
            style={{
              backgroundColor: "rgb(var(--primary))",
              color: "white",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
