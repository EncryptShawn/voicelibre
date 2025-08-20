// src/components/transcripts/hooks/useTranscripts.ts
//
// Summary:
// useTranscripts is a React client-side hook that encapsulates fetching, searching,
// filtering, and deleting saved transcript records. It provides the UI layer with
// an up-to-date list of transcripts, a filtered view based on a search query,
// and convenience handlers to refresh and remove transcripts via the server API.
//
// Imports to:
// - This hook is used by UI pages and components that list or operate on transcripts,
//   primarily: src/app/transcripts/page.tsx and any components under
//   src/components/transcripts/ that need transcript data.
//
// Exports:
// - export function useTranscripts(): A hook returning transcripts, filtered results,
//   loading state, and handlers: onSearchChange, fetchTranscripts, deleteTranscript.
//
// Exports used by:
// - src/app/transcripts/page.tsx (TranscriptPage) — wires the hook to the transcript UI.
// - src/components/transcripts/TranscriptList.tsx (indirectly via the page).
//
// Nuances:
// - The hook performs client-side filtering; it fetches the full transcript list from
//   /api/transcripts and then filters in-memory. For large transcript datasets, consider
//   server-side search/pagination in the future.
// - fetchTranscripts is memoized with useCallback to avoid unnecessary re-fetches when
//   passed to useEffect or children.
// - deleteTranscript sets isLoading while performing the delete operation and returns a
//   boolean indicating the server response success. Consumers should rely on the returned
//   promise to provide UI feedback.
// - This module intentionally keeps side effects minimal and exposes explicit handlers so
//   pages/components can orchestrate confirmation flows and toasts as needed.

// "use client" is required so this hook can use browser APIs and React client-side hooks.
"use client";

import { useState, useEffect, useCallback } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type TranscriptRecord = {
  id: string;
  title: string;
  responder: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

/**
 * useTranscripts
 *
 * Primary hook exported by this module.
 *
 * Responsibilities:
 * - Hold the complete list of transcripts and a derived filtered list.
 * - Provide a search handler that updates the filtered list based on a query.
 * - Provide fetch and delete handlers that interact with server APIs.
 *
 * Returns:
 * - transcripts: full list of fetched transcripts
 * - searchQuery: current search text
 * - filteredTranscripts: in-memory filtered list matching searchQuery
 * - isLoading: boolean indicating fetch/delete activity
 * - onSearchChange: handler to update searchQuery and filteredTranscripts
 * - fetchTranscripts: explicit handler to re-fetch the transcript list from the server
 * - deleteTranscript: handler to delete a transcript by id (returns boolean success)
 */
export function useTranscripts() {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTranscripts, setFilteredTranscripts] = useState<
    TranscriptRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * fetchTranscripts
   *
   * Fetch the full list of transcripts from the server and populate both the
   * transcripts and filteredTranscripts state. Memoized so it can safely be used
   * as a stable dependency in effects or passed to child components.
   */
  const fetchTranscripts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/transcripts");
      const data = (await response.json()) as TranscriptRecord[];
      setTranscripts(() => [...data]);
      setFilteredTranscripts(() => [...data]);
    } catch (error) {
      console.error("Failed to fetch transcripts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTranscripts();
  }, [fetchTranscripts]);

  /**
   * onSearchChange
   *
   * Update the searchQuery and refresh filteredTranscripts using a case-insensitive
   * match against transcript title and message contents. Runs synchronously and
   * derives the filtered array from the current transcripts state.
   */
  const onSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setFilteredTranscripts(
        transcripts.filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.messages.some((m) =>
              m.content.toLowerCase().includes(query.toLowerCase()),
            ),
        ),
      );
    },
    [transcripts],
  );

  /**
   * deleteTranscript
   *
   * Delete a transcript by id via the API. While deleting, sets isLoading and,
   * on success, removes the transcript from both transcripts and filteredTranscripts.
   * Returns true when the server responds with ok, otherwise false.
   */
  const deleteTranscript = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/transcripts?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setTranscripts((prev) => prev.filter((t) => t.id !== id));
        setFilteredTranscripts((prev) => prev.filter((t) => t.id !== id));
      }
      return response.ok;
    } catch (error) {
      console.error("Failed to delete transcript:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    transcripts,
    searchQuery,
    filteredTranscripts,
    isLoading,
    onSearchChange,
    fetchTranscripts,
    deleteTranscript,
  };
}
