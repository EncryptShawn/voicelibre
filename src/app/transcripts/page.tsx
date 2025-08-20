"use client";

import { useState, useEffect } from "react";
import { useTranscripts } from "../../components/transcripts/hooks/useTranscripts";
import { HeaderBar } from "../../components/HeaderBar";
import { TranscriptList } from "../../components/transcripts/TranscriptList";
import { useRouter } from "next/navigation";
import type { Message } from "../../types/message";

export default function TranscriptPage() {
  const {
    searchQuery,
    filteredTranscripts,
    onSearchChange,
    deleteTranscript,
    isLoading,
  } = useTranscripts();
  const router = useRouter();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [transcriptToDelete, setTranscriptToDelete] = useState<string | null>(
    null,
  );

  /**
   * handleReload
   *
   * Restore a transcript into the active chat session.
   * - Converts transcript records into the runtime Message[] shape.
   * - Saves them to localStorage under "transcript_restore" with the provided title.
   * - Navigates back to the chat page where the app will read "transcript_restore".
   */
  const handleReload = (
    messages: { role: "user" | "assistant"; content: string }[],
    title: string,
  ) => {
    const msgs: Message[] = messages.map((msg) => ({
      id: crypto.randomUUID(),
      text: msg.content,
      type: msg.role,
      createdAt: new Date(),
      usage: {},
    }));

    localStorage.setItem(
      "transcript_restore",
      JSON.stringify({ messages: msgs, title }),
    );
    router.push("/");
  };

  /**
   * handleReloadAndRemember
   *
   * Restore a transcript into the active chat session and mark it to be remembered.
   * - Converts transcript records into the runtime Message[] shape.
   * - Saves them to localStorage under "transcript_restore" with remember: true.
   * - Navigates back to the chat page where the app will read "transcript_restore".
   */
  const handleReloadAndRemember = (
    messages: { role: "user" | "assistant"; content: string }[],
  ) => {
    const msgs: Message[] = messages.map((msg) => ({
      id: crypto.randomUUID(),
      text: msg.content,
      type: msg.role,
      createdAt: new Date(),
      usage: {},
    }));

    localStorage.setItem(
      "transcript_restore",
      JSON.stringify({
        messages: msgs,
        remember: true,
      }),
    );
    router.push("/");
  };

  /**
   * handleDeleteTranscript
   *
   * Start the delete flow by storing the targeted transcript id and showing
   * a confirmation toast. Actual deletion occurs in confirmDelete when the
   * user confirms.
   */
  const handleDeleteTranscript = (id: string) => {
    setTranscriptToDelete(id);
    setToastMessage("Delete this transcript?");
    setShowConfirmDelete(true);
  };

  /**
   * confirmDelete
   *
   * Execute the deletion when the user confirms. Delegates to the hook's
   * deleteTranscript function and shows success/failure toasts.
   */
  const confirmDelete = async (confirmed: boolean) => {
    setShowConfirmDelete(false);

    if (confirmed && transcriptToDelete) {
      try {
        await deleteTranscript(transcriptToDelete);
        setToastMessage("Transcript deleted");
      } catch {
        setToastMessage("Failed to delete transcript");
      }
    } else {
      setToastMessage(null);
    }

    setTranscriptToDelete(null);
  };

  useEffect(() => {
    if (toastMessage && !showConfirmDelete) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, showConfirmDelete]);

  /**
   * Fix for mobile viewport / dynamic address bar:
   * set --vh to 1% of window.innerHeight so CSS can use var(--vh) instead of 100vh.
   * This prevents layout jumps / overlapping when mobile browsers hide/show UI.
   */
  useEffect(() => {
    const setVh = () => {
      if (typeof window !== "undefined") {
        document.documentElement.style.setProperty(
          "--vh",
          `${window.innerHeight * 0.01}px`,
        );
      }
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  return (
    <>
      <HeaderBar
        activeView="transcripts"
        onNav={(view) => router.push(view === "chat" ? "/" : "/transcripts")}
      />

      {/* Use the --vh trick so calc works reliably on mobile (address bar changes). 
          Keep the same visual classes you had; only replace the 100vh usage. */}
      <main className="flex h-[calc(var(--vh,1vh)*100-64px)] flex-col">
        {/* Make the search wrapper sticky so it stays locked under the header.
            Top is calc(64px + safe-area inset). Adjust 64px only if your header height differs. */}
        <div
          className="p-2"
          style={{
            position: "sticky",
            top: "calc(64px + env(safe-area-inset-top, 0))",
            zIndex: 40,
          }}
        >
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="Search transcripts"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex justify-center p-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
            </div>
          )}
          <TranscriptList
            items={filteredTranscripts}
            onReload={handleReload}
            onReloadAndRemember={handleReloadAndRemember}
            onDelete={handleDeleteTranscript}
          />
        </div>

        {toastMessage && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-gray-800 px-6 py-3 text-white shadow-lg">
            {toastMessage}
            {showConfirmDelete && (
              <div className="mt-2 flex justify-center space-x-4">
                <button
                  className="rounded bg-red-500 px-3 py-1 text-white"
                  onClick={() => confirmDelete(true)}
                >
                  Delete
                </button>
                <button
                  className="rounded bg-gray-500 px-3 py-1 text-white"
                  onClick={() => confirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
