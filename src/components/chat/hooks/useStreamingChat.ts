/*
src/components/chat/hooks/useStreamingChat.ts

Summary:
  React hook that encapsulates chat streaming behavior:
    - Creates user and assistant message placeholders in local state.
    - Sends transcription text to the backend (/api/chat) using a POST expecting
      a Server-Sent Events (SSE) text/event-stream response.
    - Streams assistant content into the assistant message in real-time.
    - Collects usage payloads from the stream and forwards them through mapUsageData.
    - Exposes streaming state and the current streaming assistant message id.

Imports to:
  - ../../chat/helpers/usage (mapUsageData)
  - ../../../types/message (Message type)
  - ../../chat/hooks/useChat (consumer)

Exports:
  - useStreamingChat

Exports used by:
  - src/components/chat/hooks/useChat.ts

Nuances:
  - Expects the server to return an SSE-style stream where lines are prefixed with "data: ".
  - The hook looks for "[DONE]" sentinel and for usage objects emitted separately in the stream.
  - It uses TextDecoder + ReadableStream.getReader() to process chunks; behavior depends on response.body availability.
  - Errors during stream parsing log to console but do not throw; an overall request failure will set the assistant message to an error string.
  - The hook relies on crypto.randomUUID() for message ids; ensure environment supports it.

*/
"use client";

import { useState, useCallback } from "react";
import type { Message } from "../../../types/message";
import { mapUsageData } from "../../chat/helpers/usage";
import type { RawUsage } from "../../chat/helpers/usage";

type WebSearchOptions = {
  search_context_size: "low" | "medium" | "high";
};

type ResponderSettings = {
  prompt: string;
  short_mem: number;
  long_mem: number;
  mem_expire: number;
};

type ChatStreamData = {
  choices?: { delta?: { content?: string } }[];
  usage?: RawUsage;
};

export function useStreamingChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );

  /**
   * Handle a new transcription by:
   *  - Appending a user message to local messages.
   *  - Creating an assistant placeholder message and streaming assistant tokens into it.
   *  - Posting to /api/chat with optional web_search_options and memory settings.
   *  - Parsing the SSE-style response (`data: ...`) and updating the assistant message text
   *    as content deltas arrive.
   *  - Collecting a usage object emitted in the stream and forwarding it to updateMessageUsage
   *    (mapped with mapUsageData).
   *
   * Parameters:
   *  - text: the transcribed user text to send to the backend.
   *  - userId: optional id of the current user (used by backend features that require auth).
   *  - selectedPrompt: responder/prompt name to select server-side behavior.
   *  - webSearchOptions: optional web search configuration to include with the request.
   *  - isMemoryActive: whether memory should be enabled for this request.
   *  - responderSettings: responder memory params used when memory is active.
   *  - setMessages: state setter for the messages array (appends/updates messages).
   *  - updateMessageUsage: callback to update usage for a message id once usage data is available.
   *  - usage: optional precomputed usage for the user message (e.g., audio usage).
   */
  const handleNewTranscription = useCallback(
    async (
      text: string,
      userId: string | undefined,
      selectedPrompt: string,
      webSearchOptions: WebSearchOptions | null,
      isMemoryActive: boolean,
      responderSettings: ResponderSettings | null,
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
      updateMessageUsage: (messageId: string, usage: RawUsage) => void,
      usage?: Message["usage"],
    ) => {
      const userMessageId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          type: "user",
          text,
          createdAt: new Date(),
          ...(usage ? { usage } : {}),
        },
      ]);

      setIsStreaming(true);
      const assistantId = crypto.randomUUID();
      setStreamingMessageId(assistantId);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          type: "assistant",
          text: "",
          createdAt: new Date(),
        },
      ]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            text,
            promptName: selectedPrompt,
            ...(webSearchOptions && { web_search_options: webSearchOptions }),
            ...(isMemoryActive && {
              memory: true,
              short_mem: responderSettings?.short_mem ?? 3,
              long_mem: responderSettings?.long_mem ?? 2,
              mem_expire: responderSettings?.mem_expire ?? 1440,
            }),
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let usageData: RawUsage | null = null;

        if (reader) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              if (line.includes("[DONE]")) {
                if (usageData) {
                  updateMessageUsage(
                    assistantId,
                    mapUsageData(usageData, false) as RawUsage,
                  );
                }
                continue;
              }

              const jsonStr = line.replace(/^data:\s*/i, "").trim();
              if (!jsonStr) continue;

              try {
                const data = JSON.parse(jsonStr) as ChatStreamData;

                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, text: msg.text + content }
                        : msg,
                    ),
                  );
                } else if (data.usage) {
                  usageData = data.usage;
                }
              } catch (e) {
                console.error("Malformed JSON in stream:", jsonStr, e);
              }
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, text: "Error getting response" }
              : msg,
          ),
        );
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [],
  );

  return {
    isStreaming,
    streamingMessageId,
    handleNewTranscription,
  };
}
