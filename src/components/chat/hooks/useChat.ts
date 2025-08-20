// src/components/chat/hooks/useChat.ts
//
// Summary:
// useChat is a central React hook that orchestrates the chat experience.
// It coordinates audio (handsfree) input/output, streaming message generation,
// memory management, and transcript saving by composing smaller hooks:
// - useHandsfree (audio recording & playback)
// - useStreamingChat (streaming chat responses)
// - useMemory (memory persistence and re-remember)
// - saveTranscript (transcript naming and saving)
// The hook exposes state and handler functions consumed by UI components such as ChatPage.
//
// Imports to:
// - Used by: src/app/chat/page.tsx
//
// Exports:
// - useChat (named export)
//
// Exports used by:
// - src/app/chat/page.tsx
//
// Nuances:
// - This is a client-only hook ("use client") because it relies on browser APIs
//   (localStorage, Audio, DOM events). Keep heavy logic in the specialized hooks.
// - Per project policy, do not add try/catch blocks here; let errors propagate.
// - Comments are targeted at explaining responsibilities; avoid trivial inline notes.

"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect } from "react";
import { useHandsfree } from "../../bottomBar/hooks/useHandsfree";
import { useStreamingChat } from "./useStreamingChat";
import { useMemory } from "../../bottomBar/hooks/useMemory";
import { saveTranscript } from "~/components/transcripts/hooks/saveTranscript";
import type { Message } from "../../../types/message";
import { mapUsageData } from "../helpers/usage";
import type { RawUsage } from "../helpers/usage";

/**
 * useChat
 *
 * Orchestrates chat state and behavior and returns the values/handlers
 * required by presentation components:
 * - messages and setters
 * - handsfree audio controls (record/play)
 * - streaming chat state and streaming message id
 * - memory state and helpers
 * - transcript naming and save handler
 *
 * Keep this hook focused on composition and coordination; delegate specific
 * side-effect logic to the underlying hooks (useHandsfree, useStreamingChat, useMemory).
 */
export function useChat() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("General");
  const [responderSettings, setResponderSettings] = useState<{
    prompt: string;
    short_mem: number;
    long_mem: number;
    mem_expire: number;
  } | null>(null);
  const [webSearchOptions, setWebSearchOptions] = useState<{
    search_context_size: "low" | "medium" | "high";
  } | null>(null);

  const streaming = useStreamingChat();
  const memory = useMemory();
  const transcript = saveTranscript();

  const updateMessageUsage = useCallback((id: string, usage: RawUsage) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, usage: mapUsageData(usage) } : msg,
      ),
    );
  }, []);

  const wrappedHandleNewTranscription = useCallback(
    (text: string, usage?: Message["usage"]) => {
      void (async () => {
        await streaming.handleNewTranscription(
          text,
          userId,
          selectedPrompt,
          webSearchOptions,
          memory.isMemoryActive,
          responderSettings,
          setMessages,
          updateMessageUsage,
          usage,
        );
      })();
    },
    [
      userId,
      selectedPrompt,
      webSearchOptions,
      responderSettings,
      updateMessageUsage,
      streaming,
      memory,
    ],
  );

  const handsfree = useHandsfree({
    onNewTranscription: wrappedHandleNewTranscription,
  });

  const ttsStartedRef = handsfree.ttsStartedRef;

  useEffect(() => {
    if (!handsfree.isHandsfreeActive) return;
    if (streaming.isStreaming) return;

    const lastAssistantMsg = [...messages]
      .reverse()
      .find(
        (m) =>
          m.type === "assistant" &&
          m.text &&
          m.id !== handsfree.currentPlayingId,
      );
    if (!lastAssistantMsg) return;

    if (ttsStartedRef.current) return;

    ttsStartedRef.current = true;

    void (async () => {
      const usage = await handsfree.handlePlayTTS(
        lastAssistantMsg.id,
        lastAssistantMsg.text,
        true, // isHandsfree flag
        () => {
          window.dispatchEvent(new Event("tts-oncomplete"));
        },
      );
      if (usage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === lastAssistantMsg.id
              ? {
                  ...msg,
                  usage: {
                    ...(msg.usage ?? {}),
                    audioUsage:
                      "audioUsage" in usage
                        ? usage.audioUsage
                        : "char_count" in usage || "latency" in usage
                          ? usage
                          : msg.usage?.audioUsage,
                  },
                }
              : msg,
          ),
        );
      }
    })();
  }, [
    handsfree,
    handsfree.isHandsfreeActive,
    handsfree.currentPlayingId,
    streaming.isStreaming,
    messages,
    ttsStartedRef,
  ]);

  useEffect(() => {
    if (!handsfree.isHandsfreeActive || streaming.isStreaming) {
      handsfree.ttsStartedRef.current = false;
    }
  }, [
    handsfree.isHandsfreeActive,
    streaming.isStreaming,
    handsfree.ttsStartedRef,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("transcript_restore");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as {
        messages?: Message[];
        title?: string;
        remember?: boolean;
      };
      if (parsed.messages && Array.isArray(parsed.messages)) {
        setMessages(parsed.messages);
      }
      if (parsed.title && transcript.setCurrentTranscriptName) {
        transcript.setCurrentTranscriptName(parsed.title);
      }
      if (parsed.remember && memory.handleMemoryReRemember && parsed.messages) {
        void memory.handleMemoryReRemember(
          parsed.messages,
          responderSettings,
          userId,
        );
      }
    } catch {
      // no-op
    }

    localStorage.removeItem("transcript_restore");
  }, [
    memory.handleMemoryReRemember,
    responderSettings,
    transcript.setCurrentTranscriptName,
    userId,
    memory,
    transcript,
  ]);

  const wrappedHandleMemoryClear = useCallback(async () => {
    await memory.handleMemoryClear(selectedPrompt, responderSettings, userId);
  }, [selectedPrompt, responderSettings, userId, memory]);

  const wrappedHandleMemoryReRemember = useCallback(async () => {
    await memory.handleMemoryReRemember(messages, responderSettings, userId);
  }, [messages, responderSettings, userId, memory]);

  return {
    messages,
    audioRef: handsfree.audioRef,
    isRecording: handsfree.isRecording,
    isVADActive: handsfree.isVADActive,
    isLoading: handsfree.isLoading,
    isStreaming: streaming.isStreaming,
    streamingMessageId: streaming.streamingMessageId,
    currentPlayingId: handsfree.currentPlayingId,
    selectedPrompt,
    responderSettings,
    webSearchOptions,
    isMemoryActive: memory.isMemoryActive,
    isHandsfreeActive: handsfree.isHandsfreeActive,
    memoryStatus: memory.memoryStatus,
    memoryProgress: memory.memoryProgress,
    memoryTotal: memory.memoryTotal,
    toastVisible: transcript.toastVisible,
    currentTranscriptName: transcript.currentTranscriptName,

    setMessages,
    setSelectedPrompt,
    setResponderSettings,
    setWebSearchOptions,
    setIsHandsfreeActive: handsfree.setIsHandsfreeActive,
    setIsMemoryActive: memory.setIsMemoryActive,
    setMemoryStatus: memory.setMemoryStatus,
    setCurrentTranscriptName: transcript.setCurrentTranscriptName,

    handleNewTranscription: wrappedHandleNewTranscription,
    handlePlayTTS: handsfree.handlePlayTTS,
    handleStopTTS: handsfree.handleStopTTS,
    startManualRecording: handsfree.startManualRecording,
    stopManualRecording: handsfree.stopManualRecording,
    handleMemoryClear: wrappedHandleMemoryClear,
    handleMemoryReRemember: wrappedHandleMemoryReRemember,
    handleSaveTranscript: transcript.handleSaveTranscript,
  };
}
