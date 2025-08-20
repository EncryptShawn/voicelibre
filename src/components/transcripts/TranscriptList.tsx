/*
  src/components/transcripts/TranscriptList.tsx

  Summary:
  TranscriptList is a presentational component that renders a scrollable list of saved
  transcript records. Each record shows metadata (title, responder, created/updated timestamps,
  and message count) and provides actions to reload the transcript into the active chat,
  reload-and-remember, or start a delete flow. The component implements touch and mouse
  interactions to reveal a temporary delete affordance.

  Imports to:
  - src/app/transcripts/page.tsx

  Exports:
  - TranscriptList (React component)
  - TranscriptRecord (type)

  Exports used by:
  - src/app/transcripts/page.tsx

  Nuances:
  - The component exposes minimal UI-only state (deleteVisibleId) used to show a temporary
    delete button when an item is double-clicked or swiped. The button automatically hides
    after 5 seconds or when the user clicks outside the item.
  - Touch handling uses a simple delta check (clientX difference > 50) to detect a swipe
    that reveals the delete control.
  - The component delegates all data mutations to callbacks provided via props (onReload,
    onReloadAndRemember, onDelete) so side effects remain outside this module.
  - Date fields (`created_at`, `updated_at`) are expected to be ISO strings from the server
    and are formatted using toLocaleString() for display.
*/
import React, { useState, useRef, useEffect } from "react";
import ReloadIcon from "../icons/Reload";
import ReloadRememberIcon from "../icons/ReloadRemember";

/**
 * TranscriptRecord
 *
 * Type describing a saved transcript entry returned from the server.
 *
 * Fields:
 * - id: unique identifier for the transcript
 * - title: human-readable name given to the transcript
 * - responder: name of the responder used when the transcript was created
 * - created_at / updated_at: ISO timestamp strings from the backend
 * - messages: array of simple message objects with role + content
 *
 * Nuances:
 * - created_at and updated_at are displayed via new Date(...).toLocaleString()
 *   and therefore rely on the server returning valid ISO date strings.
 */
export type TranscriptRecord = {
  id: string;
  title: string;
  responder: string;
  created_at: string;
  updated_at: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

/**
 * TranscriptList
 *
 * Responsibilities:
 * - Render a list of TranscriptRecord entries with summary metadata.
 * - Provide UI affordances to:
 *    * Reload a transcript into the active chat (onReload)
 *    * Reload a transcript and mark for remembering (onReloadAndRemember)
 *    * Initiate deletion of a transcript (onDelete)
 * - Handle UI interactions for revealing a temporary delete button via:
 *    * Double click / double tap
 *    * Horizontal touch move (simple threshold-based swipe)
 *    * Clicking outside the item to dismiss the delete affordance
 *
 * Props:
 * - items: array of TranscriptRecord to display
 * - onReload(messages, title): called when the user chooses to reload a transcript
 * - onReloadAndRemember(messages): called to reload and remember a transcript
 * - onDelete(id): called when the user confirms deletion (delete flow is managed upstream)
 *
 * Nuances:
 * - Visual zebra striping is applied using the index parity and CSS variables for user/assistant
 *   background colors.
 * - The component keeps UI-only state (`deleteVisibleId`) and uses a timeout to auto-hide
 *   the delete control after 5 seconds.
 */
export function TranscriptList({
  items,
  onReload,
  onReloadAndRemember,
  onDelete,
}: {
  items: TranscriptRecord[];
  onReload: (messages: TranscriptRecord["messages"], title: string) => void;
  onReloadAndRemember: (messages: TranscriptRecord["messages"]) => void;
  onDelete: (id: string) => void;
}) {
  const [deleteVisibleId, setDeleteVisibleId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!deleteVisibleId) return;

      const target = e.target as HTMLElement;
      if (!target.closest?.(".relative")) {
        setDeleteVisibleId(null);
      }
    };

    if (deleteVisibleId) {
      timeoutRef.current = setTimeout(() => {
        setDeleteVisibleId(null);
      }, 5000);

      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener("click", handleClickOutside);
    };
  }, [deleteVisibleId]);
  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="relative flex justify-between rounded-xl p-3"
          style={{
            backgroundColor:
              index % 2 === 0
                ? "rgb(var(--user-bg))"
                : "rgb(var(--assistant-bg))",
          }}
        >
          {deleteVisibleId === item.id && (
            <button
              className="absolute top-0 left-0 z-10 flex h-full w-[80px] items-center justify-center rounded-l-xl bg-red-600 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              Delete
            </button>
          )}

          <div
            className={`flex min-w-0 flex-1 flex-col pr-2 transition-transform duration-300 ${
              deleteVisibleId === item.id ? "translate-x-[80px]" : ""
            }`}
            onDoubleClick={() => setDeleteVisibleId(item.id)}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) {
                touchStartX.current = touch.clientX;
              }
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (touch && touch.clientX - touchStartX.current > 50) {
                setDeleteVisibleId(item.id);
              }
            }}
            onClick={() => deleteVisibleId && setDeleteVisibleId(null)}
          >
            <div className="truncate text-base font-bold break-words">
              {item.title}
            </div>
            <div className="text-muted-foreground text-sm">
              Responder: {item.responder}
            </div>
            <div className="text-muted-foreground text-xs">
              Created: {new Date(item.created_at).toLocaleString()}
            </div>
            <div className="text-muted-foreground text-xs">
              Updated: {new Date(item.updated_at).toLocaleString()}
            </div>
            <div className="text-muted-foreground text-xs">
              #Messages: {item.messages.length}
            </div>
          </div>
          <div className="flex flex-col items-center justify-around gap-2">
            <button
              onClick={() => onReload(item.messages, item.title)}
              title="Reload"
              className="text-foreground hover:opacity-80"
            >
              <ReloadIcon className="h-8 w-8" />
            </button>
            <button
              onClick={() => onReloadAndRemember(item.messages)}
              title="Reload & Remember"
              className="text-foreground hover:opacity-80"
            >
              <ReloadRememberIcon className="h-8 w-8" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
