/*
  src/components/chat/helpers/usage.ts

  Summary:
    Utility types and a single mapping function that normalize heterogeneous
    usage payloads returned by various services into a consistent `Message.usage`
    shape used across the application. The mapper handles multiple naming
    conventions (snake_case, camelCase) and pulls nested usage/audio fields into
    a predictable structure for UI consumption and analytics.

    Key responsibilities:
      - Define RawUsage to represent the many possible incoming fields from
        transcription, TTS, and model-usage endpoints.
      - Provide mapUsageData to normalize and coerce those fields into the
        Message.usage shape the UI expects (numbers, consistent keys).

  Imports to:
    - ../../../types/message (Message type definition)

  Exports:
    - RawUsage (type)
    - mapUsageData (function)

  Exports used by:
    - src/components/chat/ChatBubble.tsx (renders usage UI)
    - src/components/chat/hooks/useStreamingChat.ts (maps streaming usage)
    - src/components/chat/hooks/useTTSPlayer.ts (merges TTS audio usage into messages)
    - other UI/analytics code that reads Message.usage

  Nuances:
    - mapUsageData intentionally accepts flexible RawUsage (strings or numbers).
      It coerces numeric-ish strings via parseFloat to prevent runtime type issues.
    - The allowAudio flag toggles audioUsage mapping; some endpoints include
      audio usage nested under different keys (audioUsage, audio_usage).
    - The function favors values present on top-level fields, then nested
      `usage` objects; this order mirrors the most common server payload shapes.
    - The returned baseUsage contains keys that may be undefined (e.g. totalTokens)
      depending on the source payload; consumers should defensively handle absent values.
*/
"use client";

import type { Message } from "../../../types/message";

export type RawUsage = {
  cost?: number | string;
  latencyMs?: number;
  latency_ms?: number;
  ttfcMs?: number;
  ttfc_ms?: number;
  total_tokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  prompt_tokens?: number;
  completionTokens?: number;
  completion_tokens?: number;
  promptChar?: number;
  prompt_characters?: number;
  char_count?: number;
  latency?: number;
  usage?: RawUsage;
  audioUsage?: RawUsage;
  audio_usage?: RawUsage;
};

/**
 * mapUsageData
 *
 * Normalize a RawUsage object into the `Message.usage` shape used by the UI.
 *
 * - Accepts many incoming naming conventions (camelCase, snake_case, nested `usage` objects).
 * - Coerces numeric-like strings into numbers using parseFloat.
 * - Optionally maps audio usage when `allowAudio` is true. Audio usage may be found under
 *   `audioUsage`, `audio_usage`, or inferred from prompt/char fields when present.
 *
 * Parameters:
 *  - usageData: RawUsage     Raw, untrusted usage payload from a backend or external API.
 *  - allowAudio: boolean     If true, attempt to populate .audioUsage on the returned object.
 *
 * Returns:
 *  - A normalized Message["usage"] object with consistent keys:
 *      { cost, latencyMs, ttfcMs, totalTokens?, promptTokens?, completionTokens?, promptChar?, audioUsage? }
 *
 * Remarks:
 *  - This function centralizes brittle mapping logic so the rest of the app can rely
 *    on a single, well-known usage shape.
 */
export function mapUsageData(
  usageData: RawUsage,
  allowAudio = false,
): Message["usage"] {
  const cost =
    usageData.cost !== undefined
      ? parseFloat(String(usageData.cost))
      : usageData.usage?.cost !== undefined
        ? parseFloat(String(usageData.usage.cost))
        : 0;

  const latencyMs =
    usageData.latencyMs ??
    usageData.latency_ms ??
    usageData.usage?.latencyMs ??
    usageData.usage?.latency_ms ??
    0;

  const ttfcMs =
    usageData.ttfcMs ??
    usageData.ttfc_ms ??
    usageData.usage?.ttfcMs ??
    usageData.usage?.ttfc_ms ??
    0;

  const totalTokens =
    usageData.totalTokens ??
    usageData.total_tokens ??
    usageData.usage?.totalTokens ??
    usageData.usage?.total_tokens;

  const promptTokens =
    usageData.promptTokens ??
    usageData.prompt_tokens ??
    usageData.usage?.promptTokens ??
    usageData.usage?.prompt_tokens;

  const completionTokens =
    usageData.completionTokens ??
    usageData.completion_tokens ??
    usageData.usage?.completionTokens ??
    usageData.usage?.completion_tokens;

  const promptChar =
    usageData.promptChar ??
    usageData.prompt_characters ??
    usageData.char_count ??
    usageData.usage?.promptChar ??
    usageData.usage?.prompt_characters ??
    usageData.usage?.char_count;

  const baseUsage: NonNullable<Message["usage"]> = {
    cost,
    latencyMs,
    ttfcMs,
    totalTokens,
    promptTokens,
    completionTokens,
    promptChar,
  };

  if (allowAudio) {
    const audio = usageData.audioUsage ?? usageData.audio_usage;
    if (audio) {
      baseUsage.audioUsage = {
        cost:
          audio.cost !== undefined
            ? parseFloat(String(audio.cost))
            : audio.usage?.cost !== undefined
              ? parseFloat(String(audio.usage.cost))
              : 0,
        char_count:
          audio.char_count ??
          audio.promptChar ??
          audio.prompt_characters ??
          audio.usage?.char_count ??
          audio.usage?.promptChar ??
          audio.usage?.prompt_characters,
        latency:
          audio.latency ??
          audio.latencyMs ??
          audio.latency_ms ??
          audio.usage?.latency ??
          audio.usage?.latencyMs ??
          audio.usage?.latency_ms,
      };
    } else if (
      usageData.promptChar !== undefined ||
      usageData.prompt_characters !== undefined ||
      usageData.char_count !== undefined
    ) {
      baseUsage.audioUsage = {
        cost:
          usageData.cost !== undefined ? parseFloat(String(usageData.cost)) : 0,
        char_count:
          usageData.char_count ??
          usageData.promptChar ??
          usageData.prompt_characters,
        latency:
          usageData.latency ?? usageData.latencyMs ?? usageData.latency_ms,
      };
    }
  }

  return baseUsage;
}
