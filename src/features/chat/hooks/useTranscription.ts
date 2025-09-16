//compontents/transcripts/hooks/useTranscription.ts
//
// This hook manages the transcription state (start/stop) for audio recording.
// It is primarily used in conjunction with components like MicButton to control
// when transcription is active and to provide its current state to other modules.

"use client";

import { useState, useCallback } from "react";

/**
 * A custom React hook to track and control the transcription state.
 * Imported and used in components like MicButton and other voice-related features.
 */
export function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);

  const startTranscribing = useCallback(() => {
    setIsTranscribing(true);
  }, []);

  const stopTranscribing = useCallback(() => {
    setIsTranscribing(false);
  }, []);

  return {
    isTranscribing,
    startTranscribing,
    stopTranscribing,
  };
}
