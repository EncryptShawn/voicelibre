// src/components/transcripts/hooks/saveTranscript.ts
/*
Summary:
  Hook that provides a simple API to save a transcript (title + messages) to the backend,
  and exposes local UI state used by pages/components (a transient save toast and the
  current transcript name).

Imports to:
  - This file is imported by pages and components that save transcripts:
    - src/app/chat/page.tsx
    - src/app/transcripts/page.tsx
    - src/components/transcripts/modals/SaveTranscriptModal.tsx

Exports:
  - useSaveTranscript: primary hook (named export)
  - saveTranscript: alias export for compatibility

Exports used by:
  - src/app/chat/page.tsx (uses handleSaveTranscript returned by the hook)
  - src/app/transcripts/page.tsx (transcript management UI)
  - SaveTranscriptModal (via parent components that wire the hook into the modal)

Nuances:
  - The hook calls POST /api/transcript/save and expects a 2xx response. On non-ok responses
    it reads the response body and surfaces an error by returning false.
  - Messages are mapped from the local runtime Message shape to the backend payload:
    { role, content, createdAt }.
  - The hook manages only local UI state (toastVisible, currentTranscriptName) and does not
    perform any rendering itself. Callers are responsible for displaying toasts or other UI.
  - The hook returns setCurrentTranscriptName to allow callers to preset the title when needed.

*/
"use client";

import { useState, useCallback } from "react";
import type { Message } from "../../../types/message";

export function useSaveTranscript() {
  const [toastVisible, setToastVisible] = useState(false);
  const [currentTranscriptName, setCurrentTranscriptName] = useState("");

  const handleSaveTranscript = useCallback(
    async (title: string, messages: Message[] = []) => {
      try {
        const response = await fetch("/api/transcript/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            messages: messages.map((m) => ({
              role: m.type,
              content: m.text,
              createdAt: m.createdAt,
            })),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to save transcript: ${errorText}`);
        }

        setCurrentTranscriptName(title);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  return {
    toastVisible,
    currentTranscriptName,
    setCurrentTranscriptName,
    handleSaveTranscript,
  };
}

export { useSaveTranscript as saveTranscript };
