// src/app/chat/page.tsx
// Summary:
// ChatPage is the main chat interface for the application. It composes UI and orchestrates
// interactions between voice transcription, streaming chat, memory management, TTS playback,
// responder selection, and transcript saving. The component uses the useChat hook for the
// primary chat state and handlers, and renders ChatBubble instances for messages, a BottomBar
// for input/controls, a MicButton for recording controls, and various modals for responder
// editing, memory status, and transcript saving.
//
// Imports to:
// - This file is imported by the Next.js routing system as the page for the `/chat` route.
//
// Exports:
// - default ChatPage component (React component exported as default).
//
// Exports used by:
// - Next.js app routing (implicitly uses the default export to render `/chat`)
//
// Nuances:
// - The component relies heavily on the useChat hook for most state and side-effectful logic.
// - Many UI behaviors (TTS playback, streaming updates, memory toggles) are proxied to hooks
//   and child components; this file focuses on composition and a small amount of UI glue.
// - Avoid adding heavy logic here; keep feature-specific logic in hooks or child components.
// - The component assumes the runtime is client-side ("use client") and therefore uses
//   browser APIs (localStorage, DOM methods) in effects.
//
// Bottom bar integration:
// - The BottomBar component is integrated as the main control panel for chat settings and
//   features such as responder selection, memory toggling, handsfree mode, internet search,
//   and transcript saving.
// - It receives state and handlers from the useChat hook and local component state, including
//   selectedResponder, isMemoryActive, isHandsfreeActive, showMemoryMenu, and internet search flags.
// - BottomBar callbacks update chat state via useChat setters and local state setters, ensuring
//   UI and chat logic remain synchronized.
// - The BottomBar also manages responder editing and deletion through modals and confirmation flows.
// - This integration centralizes user interaction controls in a persistent UI element at the bottom
//   of the chat page, improving usability and feature discoverability.

"use client";
import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "../../components/chat/hooks/useChat";
import { EditResponderModal } from "../../components/bottomBar/modals/EditResponderModal";
import type { Responder } from "~/types/responder";
import { HeaderBar } from "../../components/HeaderBar";
import { BottomBar } from "../../components/bottomBar/BottomBar";
import { SaveTranscriptModal } from "../../components/transcripts/modals/SaveTranscriptModal";
import { ChatBubble } from "../../components/chat/ChatBubble";
import { MicButton } from "../../components/chat/MicButton";
import { MemoryStatusModal } from "../../components/bottomBar/modals/MemoryStatusModal";
import { LoginRequiredView } from "~/components/chat/LoginRequiredView";
import { useSession } from "next-auth/react";

/**
 * ChatPage
 *
 * Primary page component for the /chat route.
 *
 * Responsibilities:
 * - Compose the chat UI (header, messages list, mic button, bottom bar, modals).
 * - Coordinate a few UI-level behaviors (scroll-to-bottom, delete prompts, toast messages,
 *   short-lived memory menu display).
 * - Delegate core functionality (streaming chat, handsfree, TTS, memory) to the useChat hook
 *   and to child components.
 *
 * Notes:
 * - Keep this component focused on composition and lightweight UI glue; move non-trivial
 *   business logic into hooks or child modules.
 */
export default function ChatPage() {
  const { data: session, status } = useSession();
  const [editingResponder, setEditingResponder] = useState<Responder | null>(
    null,
  );
  const [selectedResponder, setSelectedResponder] = useState("General");
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressedRef = useRef(false);
  const [showMemoryMenu, setShowMemoryMenu] = useState(false);

  const [isInternetActive, setIsInternetActive] = useState(false);
  const [contextSize, setContextSize] = useState<"low" | "medium" | "high">(
    "low",
  );

  const [deleteVisibleId, setDeleteVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (deleteVisibleId) {
      const timer = setTimeout(() => setDeleteVisibleId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [deleteVisibleId]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const lastPressEndTimeRef = useRef<number>(0);

  /**
   * handleDeleteMessage
   *
   * Prepare a delete confirmation for either a message or a responder.
   * Sets an appropriate toast message and opens the confirmation UI.
   */
  const handleDeleteMessage = (id: string) => {
    if (id.startsWith("responder:")) {
      const name = id.replace("responder:", "");
      setMessageToDelete(name);
      setToastMessage(`Delete responder "${name}"?`);
    } else {
      setMessageToDelete(id);
      setToastMessage("Delete this message?");
    }
    setShowConfirmDelete(true);
  };

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (session) {
      fetch("/api/apikey")
        .then((res) => res.json())
        .then((data: { hasKey?: boolean }) =>
          setHasApiKey(data?.hasKey ?? false),
        )
        .catch(() => setHasApiKey(false));
    }
  }, [session]);

  /**
   * confirmDelete
   *
   * Executes deletion after user confirmation. Supports deleting responder
   * entries (via /api/responders) and individual chat messages
   * (via /api/chat/messages). Updates local UI state accordingly.
   */
  const confirmDelete = async (confirmed: boolean) => {
    setShowConfirmDelete(false);

    if (confirmed && messageToDelete) {
      const isResponder = responders.find((r) => r.name === messageToDelete);
      if (isResponder) {
        try {
          await fetch(`/api/responders/${messageToDelete}`, {
            method: "DELETE",
          });
          const updated = responders.filter((r) => r.name !== messageToDelete);
          setResponders(updated);
          setSelectedResponder(updated[0]?.name ?? "General");
          setToastMessage(`Responder "${messageToDelete}" deleted`);
        } catch {
          setToastMessage("Failed to delete responder");
        }
      } else {
        try {
          await fetch(`/api/chat/messages/${messageToDelete}`, {
            method: "DELETE",
          });

          setMessages((prev) => prev.filter((m) => m.id !== messageToDelete));
          setDeleteVisibleId(null);
          setToastMessage("Message deleted");
        } catch (error) {
          console.error("Message delete failed:", error);
          setToastMessage("Failed to delete message");
        }
      }
    } else {
      setToastMessage(null);
    }

    setMessageToDelete(null);
  };

  useEffect(() => {
    if (toastMessage && !showConfirmDelete) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, showConfirmDelete]);

  const {
    messages,
    setMessages,
    isRecording,
    isVADActive,
    isLoading,
    isStreaming,
    streamingMessageId,
    currentPlayingId,
    isHandsfreeActive,
    memoryStatus,
    memoryProgress,
    memoryTotal,
    toastVisible,
    currentTranscriptName,
    handlePlayTTS,
    handleStopTTS,
    startManualRecording,
    stopManualRecording,
    handleMemoryClear,
    handleMemoryReRemember,
    handleSaveTranscript,
    setIsHandsfreeActive,
    setSelectedPrompt,
    setResponderSettings,
    setWebSearchOptions: originalSetWebSearchOptions,
    setMemoryStatus,
    isMemoryActive,
    setIsMemoryActive,
  } = useChat();

  /**
   * setWebSearchOptions
   *
   * Lightweight wrapper around setWebSearchOptions provided by useChat.
   * Updates local UI flags (isInternetActive, contextSize) so child components
   * can reflect web-search state in the UI while delegating the actual option
   * state to the hook.
   */
  const setWebSearchOptions = (
    options: { search_context_size: "low" | "medium" | "high" } | null,
  ) => {
    if (options) {
      setIsInternetActive(true);
      setContextSize(options.search_context_size);
    } else {
      setIsInternetActive(false);
    }
    originalSetWebSearchOptions(options);
  };

  const [showSaveModal, setShowSaveModal] = useState(false);

  const [responders, setResponders] = useState<Responder[]>([]);

  useEffect(() => {
    const fetchResponders = async () => {
      const res = await fetch("/api/responders", { credentials: "include" });
      if (!res.ok) {
        console.error("Failed to fetch responders:", res.status);
        return;
      }
      const json = (await res.json()) as Responder[];
      setResponders(json);
    };
    void fetchResponders();
  }, []);

  /**
   * Scrolls to the latest message when message list updates.
   * Kept minimal: simply performs a smooth scroll when messages change.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Memory menu lifecycle management
   *
   * Automatically closes the memory menu after a timeout or when the user
   * clicks/touches outside of it.
   */
  useEffect(() => {
    if (!showMemoryMenu) return;

    const timeoutId = setTimeout(() => {
      setShowMemoryMenu(false);
    }, 4000);

    const handleClickOutside = (event: Event) => {
      const menu = document.getElementById("memory-menu");
      if (
        menu &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        setShowMemoryMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showMemoryMenu]);

  /**
   * handleScroll
   *
   * Ensures the chat view snaps to the bottom when the user is near the end
   * of the scrollable container. Guards against unnecessary jumps by checking
   * the visibility of the sentinel element.
   */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const atBottom =
      element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (atBottom && messagesEndRef.current) {
      const rect = messagesEndRef.current.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!isVisible) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  };
  if (status === "loading") return null;

  if (!session) {
    return (
      <>
        <HeaderBar
          activeView="chat"
          onNav={(view) =>
            router.push(view === "transcripts" ? "/transcripts" : "/")
          }
        />
        <main
          className="relative flex flex-col"
          style={{ height: "calc(100vh - 112px)" }}
        >
          <LoginRequiredView />
        </main>
      </>
    );
  }

  return (
    <>
      <HeaderBar
        activeView="chat"
        onNav={(view) =>
          router.push(view === "transcripts" ? "/transcripts" : "/")
        }
      />
      <main
        className="relative flex flex-col"
        style={{ height: "calc(100vh - 112px)" }}
      >
        <div
          className="flex-1 overflow-y-auto px-4 pt-4 pb-36"
          onScroll={handleScroll}
        >
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              messageId={message.id}
              text={message.text}
              type={message.type}
              usage={message.usage}
              isStreaming={isStreaming && message.id === streamingMessageId}
              isPlayingTTS={currentPlayingId === message.id}
              onPlayTTS={async () => {
                if (currentPlayingId === message.id) {
                  handleStopTTS();
                } else {
                  const usage = await handlePlayTTS(message.id, message.text);
                  if (usage) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === message.id
                          ? {
                              ...msg,
                              usage: {
                                ...(msg.usage ?? {}),
                                audioUsage:
                                  "audioUsage" in usage
                                    ? usage.audioUsage
                                    : "char_count" in usage ||
                                        "latency" in usage
                                      ? usage
                                      : msg.usage?.audioUsage,
                              },
                            }
                          : msg,
                      ),
                    );
                  }
                }
              }}
              deleteVisible={deleteVisibleId === message.id}
              onShowDelete={() => setDeleteVisibleId(message.id)}
              onHideDelete={() => setDeleteVisibleId(null)}
              onDelete={() => handleDeleteMessage(message.id)}
            />
          ))}

          <div ref={messagesEndRef} />

          {memoryStatus && (
            <MemoryStatusModal
              status={memoryStatus}
              progress={memoryProgress}
              total={memoryTotal}
              onClose={() => setMemoryStatus(null)}
            />
          )}
        </div>

        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2"
          style={{ bottom: "calc(6rem + -30px)", background: "transparent" }}
        >
          <div className="pointer-events-auto">
            {hasApiKey !== null && (
              <MicButton
                isHandsfreeActive={isHandsfreeActive}
                setIsHandsfreeActive={setIsHandsfreeActive}
                isRecording={isRecording}
                isVADActive={isVADActive}
                isLoading={isLoading}
                isPlayingAudio={!!currentPlayingId}
                disabled={!hasApiKey}
                startManualRecording={startManualRecording}
                stopManualRecording={stopManualRecording}
              />
            )}
          </div>
        </div>
      </main>
      <BottomBar
        selectedResponder={selectedResponder}
        isMemoryActive={isMemoryActive}
        showMemoryMenu={showMemoryMenu}
        isHandsfreeActive={isHandsfreeActive}
        setEditingResponder={setEditingResponder}
        onMemoryToggle={setIsMemoryActive}
        onToggleHandsfree={setIsHandsfreeActive}
        onMemoryClear={handleMemoryClear}
        onMemoryReRemember={handleMemoryReRemember}
        onSaveClick={() => setShowSaveModal(true)}
        onMemoryPressStart={() => {
          longPressedRef.current = false;

          pressTimerRef.current = setTimeout(() => {
            longPressedRef.current = true;
            setShowMemoryMenu(true);
          }, 500);
        }}
        onMemoryPressEnd={() => {
          const now = Date.now();

          if (now - lastPressEndTimeRef.current < 300) return;
          lastPressEndTimeRef.current = now;

          const isLong = longPressedRef.current;

          if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
          }

          longPressedRef.current = false;

          if (isLong ?? showMemoryMenu) return;

          setIsMemoryActive((prev) => {
            const next = !prev;
            setToastMessage(next ? "Memory enabled" : "Memory disabled");
            return next;
          });
        }}
        onPromptChange={setSelectedPrompt}
        onResponderChange={(name) => {
          setSelectedResponder(name);
          setSelectedPrompt(name);
          const responder = responders.find((r) => r.name === name);
          if (responder) {
            setResponderSettings({
              prompt: responder.prompt,
              short_mem: responder.short_mem ?? 3,
              long_mem: responder.long_mem ?? 2,
              mem_expire: responder.mem_expire ?? 1440,
            });
          }
        }}
        onWebSearchChange={(isActive, size) => {
          setWebSearchOptions(
            +isActive ? { search_context_size: size ?? contextSize } : null,
          );
        }}
        theme="dark"
        isInternetActive={isInternetActive}
        contextSize={contextSize}
        onSizeChange={setContextSize}
        onToast={setToastMessage}
        responders={responders}
        onDeleteResponder={handleDeleteMessage}
      />
      <SaveTranscriptModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={(title) => handleSaveTranscript(title, messages)}
        initialTitle={currentTranscriptName}
      />
      {toastVisible && (
        <div className="fixed right-4 bottom-16 z-50 min-w-[20%] rounded-lg bg-green-500 px-4 py-2 text-white">
          Transcript saved successfully!
        </div>
      )}
      {editingResponder && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50">
          <EditResponderModal
            responder={editingResponder}
            onClose={() => setEditingResponder(null)}
            onSave={async (updatedResponder: Responder) => {
              try {
                void fetch(`/api/responders/${editingResponder.name}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updatedResponder),
                });

                const refreshed = await fetch(
                  `/api/responders/${updatedResponder.name}`,
                );
                const latest = (await refreshed.json()) as Responder;

                setResponders((prev) =>
                  prev.map((r) => (r.id === latest.id ? latest : r)),
                );

                setSelectedResponder(latest.name ?? "General");
                setSelectedPrompt(latest.name ?? "General");
                setResponderSettings({
                  prompt: latest.prompt ?? "",
                  short_mem: latest.short_mem ?? 3,
                  long_mem: latest.long_mem ?? 2,
                  mem_expire: latest.mem_expire ?? 1440,
                });

                setToastMessage("Responder saved");
              } catch (err) {
                console.error("Failed to save responder", err);
                setToastMessage("Failed to save responder");
              } finally {
                setEditingResponder(null);
              }
            }}
          />
        </div>
      )}
      {toastMessage && (
        <div
          className={`fixed bottom-16 left-1/2 z-1000 w-fit min-w-[200px] -translate-x-1/2 transform rounded-lg px-6 py-3 text-center whitespace-nowrap text-white shadow-lg ${
            toastMessage.includes("disabled")
              ? "bg-red-500"
              : toastMessage.includes("enabled")
                ? "bg-green-500"
                : "bg-gray-800"
          }`}
        >
          {toastMessage}
          {showConfirmDelete && (
            <div className="mt-2 flex justify-center space-x-4">
              <button
                className="rounded bg-red-500 px-3 py-1 text-white"
                onClick={() => void confirmDelete(true)}
              >
                Delete
              </button>
              <button
                className="rounded bg-gray-500 px-3 py-1 text-white"
                onClick={() => void confirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
