//src/components/bottomBar/helpers/memory.ts
//
// Summary:
// Re-uploads conversation history to the backend memory service to rebuild in-memory
// context for a responder. The module provides `reRemember()` which clears existing
// memory and replays local user/assistant messages in controlled batches so the
// backend can rehydrate its memory store.
//
// Imports to:
// - src/components/bottomBar/hooks/useMemory.ts
//
// Exports:
// - reRemember
//
// Exports used by:
// - src/components/bottomBar/hooks/useMemory.ts
//
// Nuances:
// - The function first sends a mem_clear "clear" command and waits briefly to allow
//   the backend to settle before replaying history.
// - Messages are batched by both count and total characters to avoid excessively large
//   requests. A short confirmation user message is appended to each batch so the backend
//   responds with a predictable acknowledgement.
// - Responses are read as streamed bodies to ensure the server fully processes each batch.
// - The function mutates memory progress via the provided callbacks: setMemoryStatus,
//   setMemoryProgress, setMemoryTotal.
//
// "use client";

export async function reRemember(
  messages: { text: string; type: "user" | "assistant"; id: string }[],
  responderSettings: {
    prompt: string;
    short_mem: number;
    long_mem: number;
    mem_expire: number;
  } | null,
  userId: string | undefined,
  setMemoryStatus: (status: "remembering" | null) => void,
  setMemoryProgress: (progress: number) => void,
  setMemoryTotal: (total: number) => void,
) {
  /**
   * reRemember
   *
   * Responsibilities:
   * - Issue a mem_clear command to the chat API to reset backend memory for the given
   *   responder context.
   * - Convert local messages into role/content pairs and send them in batches.
   * - Update progress/total status via the provided setters so the UI can reflect progress.
   *
   * Parameters:
   * - messages: array of local messages (user/assistant) to replay
   * - responderSettings: optional responder memory settings used when replaying
   * - userId: optional user identifier forwarded to the API
   * - setMemoryStatus/setMemoryProgress/setMemoryTotal: callbacks for UI progress updates
   */
  try {
    setMemoryStatus("remembering");

    const clearResponse = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "clear",
        promptName: responderSettings?.prompt ?? "General",
        memory: true,
        mem_clear: true,
        user: userId,
      }),
    });

    if (!clearResponse.ok) throw new Error("Failed to clear memory");

    // Give backend a short pause after clearing to ensure a clean slate
    await new Promise((res) => setTimeout(res, 2000));

    const fullHistory = messages
      .filter((m) => m.type === "user" || m.type === "assistant")
      .map((m) => ({
        role: m.type,
        content: m.text,
      }));

    const batches = batchMessagesWithLimit(fullHistory, 20, 40000);
    setMemoryTotal(batches.length);

    for (let i = 0; i < batches.length; i++) {
      setMemoryProgress(i + 1);
      const batch = batches[i];
      if (!batch || !Array.isArray(batch)) continue;

      // Append a deterministic confirm message so the backend emits a short acknowledgement
      const confirmMsg = {
        role: "user",
        content: `Please respond with "Remembering ${batch.length} messages" and nothing else.`,
      };

      const fullBatch =
        batch.length > 0 ? [...batch, confirmMsg] : [confirmMsg];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fullBatch,
          promptName: responderSettings?.prompt ?? "General",
          memory: true,
          user: userId,
          short_mem: responderSettings?.short_mem ?? 3,
          long_mem: responderSettings?.long_mem ?? 2,
          mem_expire: responderSettings?.mem_expire ?? 1440,
        }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    }

    setMemoryStatus(null);
  } catch (error) {
    console.error("Failed to re-remember messages:", error);
    setMemoryStatus(null);
  }
}

/**
 * batchMessagesWithLimit
 *
 * Produces an array of message batches constrained by:
 *  - maxPerBatch: maximum number of messages per batch
 *  - maxChars: approximate maximum total characters per batch
 *
 * The algorithm accumulates messages until adding the next message would exceed
 * either limit, then starts a new batch. It preserves original message order. This is for sending mesaegs to be re-remembered by AI
 */
function batchMessagesWithLimit(
  messages: { role: "user" | "assistant"; content: string }[],
  maxPerBatch: number,
  maxChars: number,
): { role: "user" | "assistant"; content: string }[][] {
  const batches: { role: "user" | "assistant"; content: string }[][] = [];
  let batch: { role: "user" | "assistant"; content: string }[] = [];
  let charCount = 0;

  for (const msg of messages) {
    const msgLength = msg.content.length;

    if (batch.length >= maxPerBatch || charCount + msgLength > maxChars) {
      batches.push([...batch]);
      batch = [];
      charCount = 0;
    }

    batch.push(msg);
    charCount += msgLength;
  }

  if (batch.length > 0) {
    batches.push([...batch]);
  }
  return batches;
}
