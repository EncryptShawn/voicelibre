// src/components/bottomBar/hooks/useMemory.ts
//
// Summary:
// Manages client-side conversation memory state and coordinates memory-related operations
// with backend APIs. Persists the memory toggle to localStorage, exposes memory lifecycle
// state (status/progress/total), and provides actions to clear memory or re-upload
// conversation history (re-remember) via the reRemember helper.
//
// Imports to:
// - src/components/chat/hooks/useChat.ts (consumes this hook to provide memory controls in the chat UI)
//
// Exports:
// - useMemory (React hook)
//
// Exports used by:
// - src/components/chat/hooks/useChat.ts
//
// Nuances:
// - Client-only ("use client") hook — uses localStorage and expects browser APIs.
// - memoryStatus is a minimal enum: "clearing" | "remembering" | null. Consumer UI should
//   interpret this to show appropriate feedback (modals/toasts).
// - handleMemoryClear sends a "clear" command to /api/chat with memory flags; it sets
//   memoryStatus to "clearing" while in-flight and resets to null afterwards.
// - handleMemoryReRemember delegates batching and re-uploading to the reRemember helper.
// - This hook intentionally keeps logic minimal and surface-area small; heavy lifting
//   (batching, streaming) lives in src/components/bottomBar/helpers/memory.ts (reRemember).
//
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message } from "../../../types/message";
import { reRemember } from "../helpers/memory";

/**
 * useMemory
 *
 * A client-only React hook that exposes conversation memory state and control functions
 * for the chat UI.
 *
 * Responsibilities:
 * - Persist and expose isMemoryActive (localStorage)
 * - Provide memory lifecycle state: memoryStatus, memoryProgress, memoryTotal
 * - Provide actions: handleMemoryClear(selectedPrompt, responderSettings, userId)
 *   and handleMemoryReRemember(messages, responderSettings, userId)
 *
 * Returns an object with:
 * - isMemoryActive, setIsMemoryActive
 * - memoryStatus, memoryProgress, memoryTotal
 * - setMemoryStatus, setMemoryProgress, setMemoryTotal
 * - handleMemoryClear, handleMemoryReRemember
 */
export function useMemory() {
  const [isMemoryActive, setIsMemoryActive] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("isMemoryActive");
      if (stored !== null) setIsMemoryActive(stored === "true");
    }
  }, []);
  const [memoryStatus, setMemoryStatus] = useState<
    "clearing" | "remembering" | null
  >(null);
  const [memoryProgress, setMemoryProgress] = useState(0);
  const [memoryTotal, setMemoryTotal] = useState(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("isMemoryActive", isMemoryActive.toString());
    }
  }, [isMemoryActive]);

  /**
   * handleMemoryClear(selectedPrompt, responderSettings, userId)
   *
   * Sends a memory-clear command to the backend for the provided prompt/responder context.
   * - Sets memoryStatus to "clearing" while the request is in-flight.
   * - Posts { text: "clear", memory: true, mem_clear: true, ... } to /api/chat.
   * - Resets memoryStatus to null on both success and failure so consumers can hide UI state.
   *
   * Note: This function uses the responderSettings defaults when values are not provided.
   */
  const handleMemoryClear = useCallback(
    async (
      selectedPrompt: string,
      responderSettings: {
        prompt: string;
        short_mem: number;
        long_mem: number;
        mem_expire: number;
      } | null,
      userId: string | undefined,
    ) => {
      try {
        setMemoryStatus("clearing");
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "clear",
            promptName: selectedPrompt,
            memory: true,
            mem_clear: true,
            user: userId,
            short_mem: responderSettings?.short_mem ?? 3,
            long_mem: responderSettings?.long_mem ?? 2,
            mem_expire: responderSettings?.mem_expire ?? 1440,
          }),
        });

        if (!response.ok) throw new Error("Failed to clear memory");
        setMemoryStatus(null);
      } catch {
        setMemoryStatus(null);
      }
    },
    [],
  );

  /**
   * handleMemoryReRemember(messages, responderSettings, userId)
   *
   * Rehydrates backend memory by replaying the provided message list. This delegates
   * batching, streaming, and progress updates to the reRemember helper.
   *
   * Inputs:
   * - messages: array of Message objects (user/assistant) — only text/type/id are forwarded.
   * - responderSettings: memory tuning values (short_mem, long_mem, mem_expire) or null.
   * - userId: optional user identifier forwarded to the backend.
   *
   * Behavior:
   * - Calls reRemember(...) and lets it update memoryStatus/memoryProgress/memoryTotal via
   *   the provided setters.
   * - Logs errors to the console if reRemember fails.
   */
  const handleMemoryReRemember = useCallback(
    async (
      messages: Message[],
      responderSettings: {
        prompt: string;
        short_mem: number;
        long_mem: number;
        mem_expire: number;
      } | null,
      userId: string | undefined,
    ) => {
      try {
        await reRemember(
          messages.map((msg) => ({
            text: msg.text,
            type: msg.type,
            id: msg.id,
          })),
          responderSettings,
          userId,
          setMemoryStatus,
          setMemoryProgress,
          setMemoryTotal,
        );
      } catch (error) {
        console.error("Failed to re-remember:", error);
      }
    },
    [],
  );

  return {
    isMemoryActive,
    setIsMemoryActive,
    memoryStatus,
    memoryProgress,
    memoryTotal,
    setMemoryStatus,
    setMemoryProgress,
    setMemoryTotal,
    handleMemoryClear,
    handleMemoryReRemember,
  };
}
