//src/components/bottomBar/hooks/useHandsfree.ts
/*
  src/components/bottomBar/hooks/useHandsfree.ts

  Summary:
    A React hook that coordinates handsfree audio capture, voice-activity detection (VAD),
    streaming transcription, and TTS playback lifecycle. It exposes a compact interface
    used by the UI to toggle handsfree mode, start/stop manual recordings, and play/stop TTS.
    The file documents the "phases" of the handsfree cycle so developers can quickly see
    which component is responsible for each step:

      1) Idle / VAD armed
         - startVAD (helpers/vad.ts) listens to microphone levels and calls onStart when speech begins.
         - useHandsfree sets isVADActive = true while the VAD loop is running.

      2) Speech detected -> start recording
         - startVADInternal creates a MediaRecorder when VAD signals onStart and begins capturing audio.
         - isRecording is true while MediaRecorder is active.

      3) Silence detected -> stop recording & send
         - VAD signals onStop which triggers stopRecordingAndSend.
         - MediaRecorder.onstop collects chunks and sendAudioToAPI is invoked to upload audio.

      4) Transcription stream -> emit text
         - sendAudioToAPI POSTs the audio to /api/transcribe and reads a streaming SSE-like response.
         - Partial "transcript.text.delta" events are concatenated; "usage" events are parsed.
         - When a final [DONE] is received, onNewTranscription(fullText, usage) is emitted.

      5) Assistant response and TTS playback
         - useTTSPlayer (hooks/useTTSPlayer.ts) handles fetching/playing audio.
         - When TTS completes it dispatches "tts-oncomplete", which re-arms the VAD in handsfree mode.

    This separation clarifies responsibilities:
      - Mic & VAD detection: helpers/vad.ts and startVADInternal
      - Recording: MediaRecorder managed inside this hook
      - Transcription: /api/transcribe consumed in sendAudioToAPI
      - Playback: useTTSPlayer

  Imports to:
    - ../../chat/hooks/useTTSPlayer
    - ../../chat/helpers/vad

  Exports:
    - useHandsfree (default exported hook interface functions listed below)

  Exports used by:
    - src/components/bottomBar/BottomBar.tsx (Handsfree toggle and controls)
    - src/app/chat/page.tsx (via useChat hook) - coordinates UI and chat flow

  Nuances:
    - The transcription endpoint is read as a streaming body and expects event lines like:
        data: {"type":"transcript.text.delta","delta":"..."}
        data: {"usage":{...}}
        data: [DONE]
      The hook aggregates deltas and emits a single onNewTranscription call after [DONE].
    - VAD loop and MediaRecorder lifecycles are intentionally separate to keep VAD lightweight
      and only instantiate MediaRecorder when speech actually starts.
    - The hook avoids redundant re-arms while TTS is playing (isPlaying flag from useTTSPlayer).
    - isLoading signals background work (upload/transcribe) and isRecording signals capture.
*/
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTTSPlayer } from "../../chat/hooks/useTTSPlayer";
import { startVAD } from "../../chat/helpers/vad";

/**
 * useHandsfree
 *
 * Top-level hook that exposes the handsfree lifecycle and controls.
 *
 * Responsibilities:
 * - Provide state: isHandsfreeActive, isRecording, isVADActive, isLoading
 * - Manage MediaRecorder lifecycle for manual and VAD-triggered recordings
 * - Upload audio to /api/transcribe and stream-parses the response
 * - Integrate with useTTSPlayer for playback and re-arming VAD after TTS completes
 *
 * API:
 *  - isHandsfreeActive, setIsHandsfreeActive
 *  - isRecording, isVADActive, isLoading
 *  - audioRef, isPlayingTTS, currentPlayingId
 *  - handlePlayTTS, handleStopTTS
 *  - startManualRecording, stopManualRecording
 *
 * onNewTranscription:
 *   Callback invoked when a full transcription is available (after server signals [DONE]).
 *   Signature: (text: string, usage?: { cost, promptChar, latencyMs, ttfcMs }) => void
 */
export function useHandsfree({
  onNewTranscription,
}: {
  onNewTranscription: (
    text: string,
    usage?: {
      cost: number;
      promptChar: number;
      latencyMs: number;
      ttfcMs: number;
    },
  ) => void;
}) {
  const [isHandsfreeActive, setIsHandsfreeActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVADActive, setIsVADActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null!);
  const ttsStartedRef = useRef(false);
  const emittedRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const vadStopRef = useRef<(() => void) | null>(null);

  const suppressVADRef = useRef(false);

  const isPlayingRef = useRef(false);
  const isLoadingRef = useRef(false);

  const isHandsfreeRef = useRef(false);
  const blockPlaybackUntilRecordingRef = useRef(false);
  const vadArmedRef = useRef(false);

  const { isPlaying, currentMessageId, playTTS, stopTTS, prime } =
    useTTSPlayer(audioRef);

  function isMobileUserAgent(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  const handlePlayTTSWrapped = useCallback(
    async (
      messageId: string,
      text: string,
      isHandsfreeFlag = false,
      onComplete?: () => void,
    ) => {
      if (isHandsfreeFlag) {
        // Prevent VAD from triggering while we prepare playback and release mic resources.
        suppressVADRef.current = true;
        try {
          vadStopRef.current?.();
        } catch {}
        vadStopRef.current = null;
        setIsVADActive(false);

        // If a MediaRecorder is still recording, stop it and release tracks so the audio
        // hardware can be used for playback without conflict.
        if (mediaRecorderRef.current?.state === "recording") {
          try {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream
              .getTracks()
              .forEach((t) => t.stop());
          } catch {}
          setIsRecording(false);
        }

        // Ensure the TTS playback pipeline is primed/resumed under a user gesture.
        try {
          await prime();
        } catch {}

        // Small settle delay so mobile audio hardware has a moment to stabilise.
        const delayMs = isMobileUserAgent() ? 60 : 10;
        await new Promise((res) => setTimeout(res, delayMs));
      }

      return playTTS(messageId, text, isHandsfreeFlag, onComplete);
    },
    [playTTS, prime],
  );

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // If handsfree was just enabled we purposely block immediate TTS playback until
  // the mic actually begins recording. If a TTS starts while the block is active
  // and we haven't started recording yet, stop the TTS and arm VAD so we go to recording.
  useEffect(() => {
    if (!blockPlaybackUntilRecordingRef.current) return;

    // If the recorder actually started, clear the block — recording wins.
    if (isRecording) {
      blockPlaybackUntilRecordingRef.current = false;
      return;
    }

    // If playback started before recording, stop it and force VAD to arm.
    if (isPlaying) {
      try {
        stopTTS();
      } catch {}
      blockPlaybackUntilRecordingRef.current = false;
      suppressVADRef.current = false;
      if (!vadArmedRef.current) {
        try {
          startVADInternalRef.current();
        } catch {}
      }
    }
  }, [isPlaying, isRecording, stopTTS]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Wrap the setter but DO NOT prime on enable. Instead block immediate playback until
  // the mic actually starts recording so handsfree always begins by listening.
  const setIsHandsfreeActiveWrapped = useCallback(
    (active: boolean) => {
      if (active) {
        // block any immediate/automatic playback until we actually start recording
        blockPlaybackUntilRecordingRef.current = true;

        // make sure VAD gating is clear so startVADInternal can arm normally
        suppressVADRef.current = false;

        // flip handsfree; the existing effect will call startVADInternalRef.current()
        // and arm the VAD. We do NOT call prime() here to avoid priming the playback
        // pipeline which can lead to autoplaying previously queued audio.
        setIsHandsfreeActive(true);
      } else {
        // turning off clears the block and stops TTS
        blockPlaybackUntilRecordingRef.current = false;
        try {
          stopTTS();
        } catch {}
        setIsHandsfreeActive(false);
      }
    },
    [stopTTS],
  );

  /**
   * sendAudioToAPI
   *
   * Uploads the recorded audio blob to the transcription endpoint and reads a streaming
   * response. This function:
   *  - POSTs multipart/form-data to /api/transcribe
   *  - Reads the response body and concatenates incremental "transcript.text.delta" events
   *  - Captures a "usage" event if provided by the server
   *  - On receiving "data: [DONE]" it calls onNewTranscription(fullText, usage)
   *
   * Notes:
   *  - This is the bridge between raw audio capture and the chat/system transcription flow.
   */
  const sendAudioToAPI = useCallback(
    async (audioBlob: Blob, filename: string) => {
      const formData = new FormData();
      formData.append("file", audioBlob, filename);
      formData.append("model", "openai/gpt-4o-transcribe");
      emittedRef.current = false;
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Transcription failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";
        let usage:
          | {
              cost: number;
              promptChar: number;
              latencyMs: number;
              ttfcMs: number;
            }
          | undefined;

        // allow breaking the outer loop after [DONE]
        let doneReading = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.replace("data: ", "").trim();
              if (data === "[DONE]") {
                if (!emittedRef.current && fullText.trim()) {
                  emittedRef.current = true;
                  onNewTranscription(fullText, usage);
                }
                doneReading = true;
                break;
              }

              try {
                const parsed: unknown = JSON.parse(data);
                if (
                  typeof parsed === "object" &&
                  parsed !== null &&
                  "type" in parsed &&
                  (parsed as { type: string }).type === "transcript.text.delta"
                ) {
                  fullText += (parsed as { delta?: string }).delta ?? "";
                } else if (
                  typeof parsed === "object" &&
                  parsed !== null &&
                  "usage" in parsed &&
                  typeof (parsed as { usage: unknown }).usage === "object" &&
                  (parsed as { usage: object }).usage !== null
                ) {
                  const u = parsed as {
                    usage: {
                      cost?: number;
                      prompt_char?: number;
                      latency_ms?: number;
                      ttfc_ms?: number;
                    };
                  };

                  usage = {
                    cost: u.usage.cost ?? 0,
                    promptChar: u.usage.prompt_char ?? 0,
                    latencyMs: u.usage.latency_ms ?? 0,
                    ttfcMs: u.usage.ttfc_ms ?? 0,
                  };
                }
              } catch {
                // skip invalid JSON
              }
            }
          }

          if (doneReading) break;
        }
      } catch (err) {
        console.error("Transcription failed:", err);
        onNewTranscription("Failed to process audio");
      } finally {
        // Only stop loading spinner immediately if NOT in handsfree mode.
        if (!isHandsfreeRef.current) {
          setIsLoading(false);
        }
        // In handsfree mode, spinner is stopped by tts-started-flag event.
      }
    },
    [onNewTranscription],
  );

  /**
   * stopRecordingAndSend
   *
   * Stops the active MediaRecorder and associated tracks, ensures the VAD loop is stopped,
   * flips UI state (isRecording -> false, isLoading -> true) and lets MediaRecorder.onstop
   * handle bundling and sending collected chunks (sendAudioToAPI).
   *
   * Called from:
   *  - VAD's onStop handler (silence detected)
   *  - cleanup when disabling handsfree mode
   */
  const stopRecordingAndSend = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      // Gate VAD from starting a new recording until TTS fully completes
      suppressVADRef.current = true;
      setIsLoading(true);
    }
  }, []);

  /**
   * startManualRecording
   *
   * Starts a manual recording session (non-handsfree). Creates a MediaRecorder
   * immediately and begins collecting audio chunks until stopManualRecording() is called.
   */
  const startManualRecording = useCallback(async () => {
    try {
      // If TTS playback is active, stop it so the mic / audio hardware can be acquired.
      if (isPlayingRef.current) {
        try {
          stopTTS();
        } catch {}
        // Small settle delay so audio hardware has a moment to free up on mobile/desktop.
        const delayMs = isMobileUserAgent() ? 60 : 10;
        await new Promise((res) => setTimeout(res, delayMs));
      }

      // Also fully stop any VAD loop so it can't race with manual recording.
      try {
        vadStopRef.current?.();
      } catch {}
      vadStopRef.current = null;
      setIsVADActive(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) =>
        audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const filename = mimeType.includes("mp4")
          ? "recording.mp4"
          : "recording.webm";
        await sendAudioToAPI(blob, filename);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, [sendAudioToAPI, stopTTS]);

  /**
   * stopManualRecording
   *
   * Stops an ongoing manual MediaRecorder session and terminates tracks.
   * The MediaRecorder.onstop callback will package the chunks and call sendAudioToAPI.
   */
  const stopManualRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    }
  }, []);

  // Internal: VAD loop for handsfree mode
  /**
   * startVADInternal
   *
   * Arms the VAD loop and waits for speech. When the VAD detects speech it:
   *  - creates a MediaRecorder
   *  - starts recording (isRecording = true)
   *  - relies on the VAD onStop handler to call stopRecordingAndSend on silence
   *
   * The VAD remains light-weight and only instantiates MediaRecorder on actual speech.
   */
  const startVADInternal = useCallback(() => {
    // Only arm VAD once per session
    if (vadArmedRef.current) return;
    vadArmedRef.current = true;

    const stopFn = startVAD({
      onStart: () => {
        if (
          suppressVADRef.current ||
          isPlayingRef.current ||
          isLoadingRef.current ||
          !isHandsfreeRef.current ||
          mediaRecorderRef.current?.state === "recording"
        ) {
          return;
        }

        void (async () => {
          audioChunksRef.current = [];
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
          });

          const mimeType = MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "";
          mimeTypeRef.current = mimeType;

          const mediaRecorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined,
          );
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (e) =>
            audioChunksRef.current.push(e.data);

          mediaRecorder.onstop = async () => {
            setIsRecording(false);
            const blob = new Blob(audioChunksRef.current, {
              type: mimeType || "audio/webm",
            });
            const filename = mimeType.includes("mp4")
              ? "recording.mp4"
              : "recording.webm";
            await sendAudioToAPI(blob, filename);
          };

          mediaRecorder.start();
          setIsRecording(true);
        })();
      },
      onStop: () => {
        stopRecordingAndSend();
      },
      silenceDuration: 2000,
      volumeThreshold: 10,
    });

    vadStopRef.current = stopFn;
    setIsVADActive(true);
  }, [sendAudioToAPI, stopRecordingAndSend]);
  const startVADInternalRef = useRef(startVADInternal);
  const stopRecordingAndSendRef = useRef(stopRecordingAndSend);
  useEffect(() => {
    startVADInternalRef.current = startVADInternal;
    stopRecordingAndSendRef.current = stopRecordingAndSend;
  }, [startVADInternal, stopRecordingAndSend]);

  // React to handsfree mode changes
  useEffect(() => {
    isHandsfreeRef.current = isHandsfreeActive;
    if (isHandsfreeActive) {
      if (!vadArmedRef.current) {
        startVADInternalRef.current();
      }
    } else {
      // Turning handsfree OFF: fully release mic/VAD and clear gates
      suppressVADRef.current = false;
      vadStopRef.current?.();
      vadStopRef.current = null;
      vadArmedRef.current = false;
      setIsVADActive(false);
      if (mediaRecorderRef.current?.state === "recording") {
        stopRecordingAndSendRef.current();
      }
    }
  }, [isHandsfreeActive]);

  // Re-arm VAD after TTS completes (handsfree only)
  useEffect(() => {
    if (!isHandsfreeActive) return;

    const handleTTSStart = () => {
      // stop spinner during playback and HARD-disable VAD so it can't fire mid-TTS
      setIsLoading(false);
      setIsRecording(false);
      suppressVADRef.current = true;

      // fully stop the VAD loop to prevent onStart/onStop during playback
      vadStopRef.current?.();
      vadStopRef.current = null;
      vadArmedRef.current = false;
      setIsVADActive(false);
    };

    const handleTTSComplete = () => {
      // small debounce gives the output audio a moment to fully stop leaking into the mic
      setTimeout(() => {
        if (!isHandsfreeActive) return;
        setIsLoading(false);
        setIsRecording(false);
        suppressVADRef.current = false;
        // re-arm VAD cleanly after TTS
        if (!vadArmedRef.current) startVADInternalRef.current();
      }, 300);
    };

    window.addEventListener("tts-started-flag", handleTTSStart);
    window.addEventListener("tts-oncomplete", handleTTSComplete);
    return () => {
      window.removeEventListener("tts-started-flag", handleTTSStart);
      window.removeEventListener("tts-oncomplete", handleTTSComplete);
    };
  }, [isHandsfreeActive]);

  // Auto-disable handsfree if the tab is hidden or the page is unloading
  useEffect(() => {
    const turnOff = () => setIsHandsfreeActiveWrapped(false);

    const onVisibility = () => {
      if (document.hidden) turnOff();
    };

    window.addEventListener("visibilitychange", onVisibility, {
      passive: true,
    });
    window.addEventListener("pagehide", turnOff, { passive: true });
    window.addEventListener("beforeunload", turnOff);

    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", turnOff);
      window.removeEventListener("beforeunload", turnOff);
    };
  }, [setIsHandsfreeActiveWrapped]);

  useEffect(() => {
    return () => {
      // Stop TTS pipeline
      try {
        stopTTS();
      } catch {}

      // Stop active recorder and release mic tracks
      try {
        if (mediaRecorderRef.current) {
          if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
          mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
        }
      } catch {}

      // Stop VAD loop
      try {
        vadStopRef.current?.();
      } catch {}
      vadStopRef.current = null;
    };
  }, [stopTTS]);

  return {
    isHandsfreeActive,
    setIsHandsfreeActive: setIsHandsfreeActiveWrapped,
    isRecording,
    isVADActive,
    isLoading,
    audioRef,
    isPlayingTTS: isPlaying,
    currentPlayingId: currentMessageId,
    handlePlayTTS: handlePlayTTSWrapped,
    handleStopTTS: stopTTS,
    startManualRecording,
    stopManualRecording,
    ttsStartedRef,
  };
}
