// src/components/chat/ChatBubble.tsx
//
// Summary:
// ChatBubble renders a single chat message bubble for user or assistant messages.
// Handles streaming updates, deletion UI, usage display and TTS playback controls.
// This component is presentation-focused; business logic is handled by hooks (e.g. useChat).
//
// Imports to:
// - Used by: src/app/chat/page.tsx
//
// Exports:
// - ChatBubble (named export)
//
// Exports used by:
// - src/app/chat/page.tsx
//
// Nuances:
// - Reads CSS custom properties at runtime to compute colors; provides safe SSR fallback.
// - Keep heavy logic in hooks or parent components; this file should remain focused on UI.
// - Major functions have brief descriptions; avoid trivial inline comments.

import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "~/lib/theme-provider";

/**
 * getRGBVar
 *
 * Read a CSS custom property on :root and return a CSS rgb(...) string.
 * Returns a safe fallback during SSR (when window is undefined).
 *
 * Used by this module to compute bubble and text colors from theme variables.
 */
function getRGBVar(variableName: string) {
  if (typeof window === "undefined") return "rgb(0,0,0)";
  const style = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()
    .split(" ")
    .map((v) => v.trim())
    .join(",");
  return `rgb(${style})`;
}

type UsageData = {
  cost?: number;
  promptChar?: number;
  latencyMs?: number;
  ttfcMs?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  totalTokens?: number;
  audioUsage?: {
    cost?: number;
    char_count?: number;
    latency?: number;
  };
};

type ChatBubbleProps = {
  messageId: string;
  text: string;
  type: "user" | "assistant";
  isStreaming?: boolean;
  usage?: UsageData;
  className?: string;
  isPlayingTTS?: boolean;
  onPlayTTS?: () => void;
  deleteVisible?: boolean;
  onShowDelete?: () => void;
  onHideDelete?: () => void;
  onDelete?: () => void;
};

/**
 * ChatBubble
 *
 * Visual component that renders a chat message bubble and exposes interaction handlers:
 * - deletion gestures and UI
 * - streaming text updates
 * - TTS playback control and usage display
 *
 * Public props are described by the ChatBubbleProps type above.
 *
 * Used in: src/app/chat/page.tsx
 */
export function ChatBubble({
  messageId,
  text,
  type,
  isStreaming = false,
  usage,
  isPlayingTTS = false,
  onPlayTTS,
  deleteVisible = false,
  onShowDelete,
  onHideDelete,
  onDelete,
}: ChatBubbleProps) {
  useTheme();

  const [streamedText, setStreamedText] = useState(text);
  const [showUsage, setShowUsage] = useState(false);

  // TTS loading state: true after button press, until playback starts
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  useEffect(() => {
    if (isStreaming) setStreamedText(text);
  }, [text, isStreaming]);

  // When playback starts, clear loading state
  useEffect(() => {
    if (isPlayingTTS) setIsTTSLoading(false);
  }, [isPlayingTTS]);

  const isAssistant = type === "assistant";

  const touchStartX = useRef<number>(0);

  return (
    <div
      className={`relative flex w-full ${
        isAssistant ? "justify-start" : "justify-end"
      } mb-2`}
    >
      {/* Delete button */}
      {deleteVisible && (
        <button
          className="absolute top-0 left-0 z-10 flex h-full w-[80px] items-center justify-center rounded-l-2xl bg-red-600 text-white"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
        >
          Delete
        </button>
      )}

      {/* Message bubble */}
      <div
        className={`relative z-20 max-w-[80%] min-w-[200px] rounded-2xl px-4 py-3 text-base transition-transform duration-300 ${
          deleteVisible ? "translate-x-[80px]" : ""
        }`}
        onDoubleClick={() => !isStreaming && onShowDelete?.()}
        onTouchStart={(e) => {
          if (isStreaming) return;
          const touch = e.touches[0];
          if (touch) {
            touchStartX.current = touch.clientX;
          }
        }}
        onTouchMove={(e) => {
          if (isStreaming) return;
          const touch = e.touches[0];
          if (touch && touch.clientX - touchStartX.current > 50) {
            onShowDelete?.();
          }
        }}
        onClick={() => deleteVisible && onHideDelete?.()}
        style={{
          backgroundColor: isAssistant
            ? getRGBVar("--assistant-bg")
            : getRGBVar("--user-bg"),
          color: isAssistant
            ? getRGBVar("--assistant-text")
            : getRGBVar("--user-text"),
          borderTopLeftRadius: isAssistant ? 0 : "1.5rem",
          borderTopRightRadius: !isAssistant ? 0 : "1.5rem",
        }}
      >
        {isStreaming ? streamedText : text}
        {type === "assistant" && onPlayTTS && (
          <button
            onClick={() => {
              if (isPlayingTTS) {
                setIsTTSLoading(false);
              } else {
                setIsTTSLoading(true);
              }
              onPlayTTS();
            }}
            className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full p-1"
            style={{
              backgroundColor: "rgba(var(--foreground), 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(var(--foreground), 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(var(--foreground), 0.1)";
            }}
            aria-label={
              isTTSLoading
                ? "Loading TTS"
                : isPlayingTTS
                  ? "Stop TTS"
                  : "Play TTS"
            }
            data-tts-btn
            data-message-id={messageId}
            disabled={isTTSLoading}
          >
            {isTTSLoading && !isPlayingTTS ? (
              // Spinner SVG
              <svg
                className="text-foreground h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : isPlayingTTS ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
              </svg>
            )}
          </button>
        )}
        {usage && (
          <div className="relative z-30 mt-2 w-full">
            <div
              className="hover:text-muted-foreground flex cursor-pointer items-center justify-end gap-1 text-xs"
              onClick={() => setShowUsage(!showUsage)}
            >
              <span className="text-foreground">usage</span>
              <span className="text-foreground text-xs">
                {showUsage ? "▼" : "▶"}
              </span>
            </div>
            {showUsage && (
              <div className="border-border bg-background text-foreground mt-1 w-full rounded border-t p-1 text-xs">
                <div className="flex justify-between">
                  <span>cost: ${Number(usage.cost).toFixed(6)}</span>
                  {typeof usage.totalTokens === "number" ? (
                    <span>tokens: {usage.totalTokens}</span>
                  ) : usage.promptChar ? (
                    <span>length: {usage.promptChar}s</span>
                  ) : null}
                </div>
                <div className="mt-1 flex justify-end">
                  <span>
                    latency: {usage.ttfcMs}/{usage.latencyMs}ms
                  </span>
                </div>
                {usage.audioUsage && (
                  <div className="border-border bg-background text-foreground mt-2 w-full border-t pt-1 text-xs">
                    <div className="flex justify-between">
                      <span>
                        audio cost: ${Number(usage.audioUsage.cost).toFixed(6)}
                      </span>
                      <span>
                        chars:{" "}
                        {usage.audioUsage.char_count ??
                          usage.audioUsage.char_count}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <span>latency: {usage.audioUsage.latency}ms</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
