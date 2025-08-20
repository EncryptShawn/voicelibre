// src/components/chat/helpers/stream.ts
//
// Stream response utility for chat SSE
//
// This module reads a streaming `Response` from the chat API (`/api/chat`) and emits
// decoded data chunks while capturing usage metadata. It is used inside the chat
// system, especially in `useStreamingChat`, to progressively build assistant messages
// and gather token/audio usage information.
//##########################################

// Creates a readable stream from an API response and extracts usage data for analytics.
// Used in: `useStreamingChat` (chat/hooks/useStreamingChat.ts)
export function createResponseStream(
  response: Response,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let usageData: unknown = null;
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const parsed: unknown = JSON.parse(jsonStr);
              if (
                typeof parsed === "object" &&
                parsed !== null &&
                "usage" in parsed
              ) {
                usageData = (parsed as { usage: unknown }).usage;
              }
            } catch {
              console.warn("Skipping malformed JSON:", jsonStr);
            }
          }

          controller.enqueue(new TextEncoder().encode(chunk));
        }

        if (usageData) {
          const finalChunk = `data: ${JSON.stringify({ usage: usageData })}\n\n`;
          controller.enqueue(new TextEncoder().encode(finalChunk));
        }
      } finally {
        reader?.releaseLock();
        controller.close();
      }
    },
  });
}
