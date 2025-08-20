// src/components/chat/MicButton.tsx
//
// Summary:
// MicButton renders the primary circular microphone button used for both manual
// recording and handsfree modes. It displays loading/playing states and (when audio
// is playing) a canvas-based waveform visualizer that attaches to the global audio element.
// The component is presentation-focused and delegates actual recording/playback logic
// to hooks (e.g. useHandsfree).
//
// Imports to:
// - Used by: src/app/chat/page.tsx
//
// Exports:
// - MicButton (named export)
//
// Exports used by:
// - src/app/chat/page.tsx
//
// Nuances:
// - This is a client-only UI component ("use client") because it interacts with
//   window events and the Web Audio API for the waveform visualizer.
// - Keep heavy logic (media capture, TTS playback) in hooks; this file should remain UI-focused.
//
// - Major functions have brief descriptions at the top of the file; avoid trivial inline comments.
// src/components/chat/MicButton.tsx
// src/components/chat/MicButton.tsx
"use client";

import React, { useRef, useEffect } from "react";

interface MicButtonProps {
  className?: string;
  isHandsfreeActive: boolean;
  setIsHandsfreeActive: (active: boolean) => void;
  isRecording: boolean;
  isVADActive: boolean;
  isLoading: boolean;
  isPlayingAudio?: boolean;
  disabled?: boolean;
  startManualRecording: () => void;
  stopManualRecording: () => void;
}

type AudioContextCtor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;

/**
 * Returns the correct AudioContext constructor for the current browser.
 * Ensures compatibility with both standard and webkit-prefixed implementations.
 */
function getAudioContextCtor(): AudioContextCtor {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return (w.AudioContext ?? w.webkitAudioContext)!;
}

export function MicButton({
  className = "",
  isHandsfreeActive,
  setIsHandsfreeActive,
  isRecording,
  isLoading,
  isPlayingAudio = false,
  disabled,
  startManualRecording,
  stopManualRecording,
}: MicButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackStreamRef = useRef<MediaStream | null>(null);

  /**
   * Starts the waveform visualizer for the provided audio stream.
   * Sets up the audio context, analyser, and canvas drawing loop.
   */
  const startVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;

    ctxRef.current ??= new (getAudioContextCtor())();
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        return;
      });
    }

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
    }
    const analyser = analyserRef.current;
    if (!analyser) return;

    try {
      sourceRef.current?.disconnect();
    } catch {
      // ignore
    }
    sourceRef.current = ctx.createMediaStreamSource(stream);
    sourceRef.current.connect(analyser);

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.fftSize;
    const timeData = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(timeData);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#ffffff";
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i]! / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.stroke();
    };

    if (!animationRef.current) draw();
  };

  /**
   * Stops and cleans up the waveform visualizer.
   * Cancels animation, disconnects audio nodes, and clears the canvas.
   */
  const stopVisualizer = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      // ignore
    }
    analyserRef.current = null;
    sourceRef.current = null;
    try {
      void ctxRef.current?.close().catch(() => undefined);
    } catch {
      // ignore
    }
    ctxRef.current = null;

    const c = canvasRef.current;
    if (c) {
      const g = c.getContext("2d");
      g?.clearRect(0, 0, c.width, c.height);
    }
  };

  /**
   * Handles all button click logic:
   * - Navigates to API key page if disabled
   * - Toggles handsfree mode
   * - Starts or stops manual recording
   */
  const handleClick = () => {
    if (disabled) {
      window.location.href = "/apikey";
      return;
    }
    if (isHandsfreeActive) {
      setIsHandsfreeActive(false);
      return;
    }
    if (!isRecording) {
      startManualRecording();
    } else {
      stopManualRecording();
    }
  };

  /**
   * Effect: Listens for TTS playback events to start/stop the visualizer
   * when audio playback begins or ends.
   */
  useEffect(() => {
    const onPlaybackStarted = (e: Event) => {
      const ce = e as CustomEvent<HTMLAudioElement>;
      const audio = ce.detail;
      if (!audio) return;

      const obj = (audio as HTMLMediaElement).srcObject;
      const stream = obj instanceof MediaStream ? obj : null;

      if (stream) {
        playbackStreamRef.current = stream;
        if (canvasRef.current && !animationRef.current) {
          startVisualizer(stream);
        }
        return;
      }

      queueMicrotask(() => {
        const lateObj = (audio as HTMLMediaElement).srcObject;
        const late = lateObj instanceof MediaStream ? lateObj : null;
        if (late) {
          playbackStreamRef.current = late;
          if (canvasRef.current && !animationRef.current) {
            startVisualizer(late);
          }
        }
      });
    };

    const onTTSComplete = () => {
      stopVisualizer();
    };

    window.addEventListener("tts-playback-started", onPlaybackStarted);
    window.addEventListener("tts-oncomplete", onTTSComplete);
    return () => {
      window.removeEventListener("tts-playback-started", onPlaybackStarted);
      window.removeEventListener("tts-oncomplete", onTTSComplete);
      stopVisualizer();
    };
  }, []);

  /**
   * Effect: If UI flips to "playing" after stream is captured,
   * starts the visualizer for the playback stream.
   */
  useEffect(() => {
    if (isPlayingAudio && playbackStreamRef.current && !animationRef.current) {
      startVisualizer(playbackStreamRef.current);
    }
  }, [isPlayingAudio]);

  /**
   * Effect: When leaving handsfree and no audio is playing,
   * ensures the visualizer is stopped and cleaned up.
   */
  useEffect(() => {
    if (!isHandsfreeActive && !isPlayingAudio) {
      stopVisualizer();
    }
  }, [isHandsfreeActive, isPlayingAudio]);

  return (
    <button
      className={`mx-auto my-8 flex h-20 w-20 items-center justify-center rounded-full ${
        isRecording ? "bg-red-500" : "bg-[#00B4D8]"
      } shadow-lg transition active:scale-95 ${className}`}
      aria-label="Microphone"
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      style={{ outline: "none", position: "relative" }}
    >
      {isRecording ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="9" y="3" width="6" height="10" rx="3" fill="currentColor" />
          <path
            d="M5 11v1a7 7 0 0 0 14 0v-1M12 21v-2"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      ) : isLoading ? (
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
      ) : isPlayingAudio ? (
        <span
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderRadius: "50%",
          }}
        >
          <canvas
            ref={canvasRef}
            width={96}
            height={80}
            style={{
              display: "block",
              background: "transparent",
              marginLeft: "10px",
              width: "96px",
              height: "80px",
              pointerEvents: "none",
            }}
          />
        </span>
      ) : (
        // Idle mic
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="9" y="3" width="6" height="10" rx="3" fill="currentColor" />
          <path
            d="M5 11v1a7 7 0 0 0 14 0v-1M12 21v-2"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
