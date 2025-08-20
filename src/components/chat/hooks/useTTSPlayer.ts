/*
src/components/chat/hooks/useTTSPlayer.ts

Summary:
  React hook that manages Text-to-Speech (TTS) playback. Responsibilities:
    - Request TTS audio blobs from the backend (/api/tts).
    - Cache generated audio (in-memory via URL.createObjectURL) to avoid refetching.
    - Chunk long text into an intro + remainder and queue remainder for sequential playback.
    - Control the HTMLAudioElement lifecycle and emit window events used by UI (e.g. "tts-playback-started", "tts-oncomplete").
    - Aggregate simple audio usage metrics when provided via the 'x-audio-details' response header.

Imports to:
  - ../helpers/chunkTextForTTS

Exports:
  - useTTSPlayer

Exports used by:
  - src/components/bottomBar/hooks/useHandsfree.ts
  - src/components/chat/hooks/useChat.ts

Nuances:
  - The hook expects a server endpoint at /api/tts that returns an audio blob and
    optionally an 'x-audio-details' header containing JSON with { cost, promptChar, latencyMs }.
  - Audio is cached in-memory; URLs are not revoked here. If long-running memory is a concern,
    consider revoking URLs when appropriate.
  - The hook dispatches DOM events to integrate with other UI (MicButton visualiser subscribes to "tts-playback-started").
  - The hook does not persist audio cache between page reloads.
*/

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { chunkTextForTTS } from "../helpers/chunkTextForTTS";

type AudioUsage = {
  audioUsage: {
    cost: number;
    char_count: number;
    latency: number;
  };
} | null;

type DecodedAudio = {
  buffer: AudioBuffer;
  usage: AudioUsage;
};

/**
 * Returns the appropriate AudioContext constructor for the current browser.
 * Handles cross-browser compatibility for AudioContext.
 */
type AudioContextCtor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;
function getAudioContextCtor(): AudioContextCtor {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return (w.AudioContext ?? w.webkitAudioContext)!;
}

/**
 * Sets a MediaStream as the source object on an HTMLAudioElement.
 */
function setStreamOnAudio(el: HTMLAudioElement, stream: MediaStream) {
  (el as HTMLMediaElement).srcObject = stream;
}
/**
 * Retrieves the MediaStream from an HTMLAudioElement, if present.
 */
function getStreamFromAudio(el: HTMLAudioElement): MediaStream | null {
  const obj = (el as HTMLMediaElement).srcObject;
  return obj instanceof MediaStream ? obj : null;
}

/**
 * Resample an AudioBuffer to target sampleRate using OfflineAudioContext.
 * Returns a new AudioBuffer rendered at targetSampleRate.
 */
async function resampleToSampleRate(
  buf: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  const numChannels = buf.numberOfChannels;
  const length = Math.ceil(buf.duration * targetSampleRate);
  const offline = new OfflineAudioContext(
    numChannels,
    length,
    targetSampleRate,
  );
  const src = offline.createBufferSource();
  src.buffer = buf;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered;
}

/**
 * Detects if the current device is a mobile device.
 */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isAndroidUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android/i.test(navigator.userAgent) &&
    !/iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

/**
 * React hook that manages Text-to-Speech (TTS) playback, audio pipeline, and queueing.
 * Handles fetching, decoding, caching, and playing TTS audio, and exposes playback controls.
 */
export function useTTSPlayer(audioRef: React.RefObject<HTMLAudioElement>) {
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioBufferCacheRef = useRef<Record<string, AudioBuffer>>({});

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  type QueueItem = {
    buffer: AudioBuffer;
    baseMessageId: string;
    isHandsfree: boolean;
    lastChunk: boolean;
    onComplete?: () => void;
  };
  const playQueueRef = useRef<QueueItem[]>([]);
  const isDequeuingRef = useRef(false);
  const currentNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const primedRef = useRef(false);
  const startedPullRef = useRef(false);

  /**
   * Initializes and primes the audio pipeline for playback.
   * Sets up AudioContext, gain, analyser, and stream destination nodes.
   */
  const primePipeline = useCallback(async () => {
    if (primedRef.current) return;

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;

    ctxRef.current ??= new (getAudioContextCtor())({
      latencyHint: "interactive",
    });
    const ctx = ctxRef.current;
    if (!ctx) return;

    masterGainRef.current ??= ctx.createGain();
    analyserRef.current ??= ctx.createAnalyser();

    const master = masterGainRef.current;
    const analyser = analyserRef.current;

    // Determine Android vs non-Android without using `any`.
    interface MaybeUAData {
      platform?: string;
    }
    const nav =
      typeof navigator !== "undefined"
        ? (navigator as unknown as Navigator & { userAgentData?: MaybeUAData })
        : undefined;

    let isAndroid = false;
    if (nav?.userAgentData && typeof nav.userAgentData.platform === "string") {
      isAndroid =
        /Android/i.test(nav.userAgentData.platform) &&
        !/iPhone|iPad|iPod/i.test(nav.userAgentData.platform);
    } else {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      isAndroid = /Android/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
    }

    // Always connect master -> analyser so visualisers still work.
    master.connect(analyser);

    // Always create a visual MediaStream destination (used by the waveform visualiser).
    // For non-Android we will attach that stream to the <audio> element so the element
    // can play it. For Android we will *not* attach it (we output to ctx.destination),
    // but we will still expose the visual stream to the visualiser via the event.
    streamDestRef.current ??= ctx.createMediaStreamDestination();
    const streamDest = streamDestRef.current;
    try {
      analyser.connect(streamDest);
    } catch {}

    if (isAndroid) {
      // Android: connect directly to ctx.destination for stable playback (fixes speed/tone).
      try {
        master.connect(ctx.destination);
      } catch {}
    } else {
      // non-Android: attach the visual stream to the audio element (original behaviour).
      try {
        setStreamOnAudio(audio, streamDest.stream);
      } catch {}
    }

    audio.preload = "auto";
    audio.autoplay = false;
    // start muted/zero volume to allow autoplay to start the pull silently if needed.
    audio.muted = true;
    audio.volume = 0; // explicit

    (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;

    // Only attempt to start the element pull if it actually has a stream attached.
    const hasStreamOnAudio = !!getStreamFromAudio(audio);
    if (!startedPullRef.current && hasStreamOnAudio) {
      try {
        await audio.play();
      } catch {}
      startedPullRef.current = true;
    }

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* noop */
      }
    }

    primedRef.current = true;
  }, [audioRef]);

  /**
   * Ensures the audio pipeline is ready and the AudioContext is running.
   * Returns true if playback is possible.
   */
  const ensurePlaybackReady = useCallback(async (): Promise<boolean> => {
    await primePipeline();
    const ctx = ctxRef.current;
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    return ctx.state === "running";
  }, [primePipeline]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return () => {
      try {
        currentNodeRef.current?.stop(0);
      } catch {}
      currentNodeRef.current = null;
      playQueueRef.current = [];
      isDequeuingRef.current = false;

      const audioAtMount = audioRef.current;
      if (audioAtMount) {
        try {
          audioAtMount.pause();
        } catch {}
        audioAtMount.srcObject = null;
        audioAtMount.src = "";
      }

      try {
        masterGainRef.current?.disconnect();
      } catch {}
      try {
        analyserRef.current?.disconnect();
      } catch {}
      try {
        streamDestRef.current?.disconnect();
      } catch {}

      if (ctxRef.current && ctxRef.current.state !== "closed") {
        void ctxRef.current.close().catch(() => undefined);
      }
      ctxRef.current = null;
      masterGainRef.current = null;
      analyserRef.current = null;
      streamDestRef.current = null;
      primedRef.current = false;
      setIsPlaying(false);
      setCurrentMessageId(null);
    };
  }, [audioRef]);

  /**
   * Tears down the audio pipeline and resets playback state.
   * Stops any current playback and clears the queue.
   */
  const teardownPipeline = useCallback(() => {
    try {
      currentNodeRef.current?.stop(0);
    } catch {}
    currentNodeRef.current = null;
    playQueueRef.current = [];
    isDequeuingRef.current = false;
    setIsPlaying(false);
    setCurrentMessageId(null);
  }, []);

  /**
   * Fetches TTS audio from the backend and decodes it into an AudioBuffer.
   * Caches decoded audio for future playback.
   */
  const fetchAndDecode = useCallback(
    async (messageId: string, text: string): Promise<DecodedAudio | null> => {
      if (audioBufferCacheRef.current[messageId] && ctxRef.current) {
        return { buffer: audioBufferCacheRef.current[messageId], usage: null };
      }

      await primePipeline();
      const ctx = ctxRef.current;
      if (!ctx) return null;

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        console.error("TTS API Error:", await response.text());
        return null;
      }

      const blob = await response.blob();
      if (!blob.size) {
        console.error("Invalid audio blob received");
        return null;
      }

      let buffer: AudioBuffer;
      try {
        const arr = await blob.arrayBuffer();
        buffer = await ctx.decodeAudioData(arr.slice(0));
      } catch (e) {
        console.error("decodeAudioData failed", e);
        return null;
      }

      // On Android: resample decoded buffer to AudioContext.sampleRate to avoid
      // runtime resampling differences that can change perceived speed/tone.
      if (
        isAndroidUserAgent() &&
        ctx.sampleRate &&
        buffer.sampleRate !== ctx.sampleRate
      ) {
        try {
          buffer = await resampleToSampleRate(buffer, ctx.sampleRate);
        } catch (e) {
          // If resampling fails, fall back to original buffer (best-effort).
          console.warn("Android resample failed — using original buffer", e);
        }
      }

      audioBufferCacheRef.current[messageId] = buffer;

      const header = response.headers.get("x-audio-details");
      let usage: AudioUsage = null;
      if (header) {
        try {
          const parsed = JSON.parse(header) as {
            cost: number;
            promptChar: number;
            latencyMs: number;
          };
          usage = {
            audioUsage: {
              cost: parsed.cost,
              char_count: parsed.promptChar,
              latency: parsed.latencyMs,
            },
          };
        } catch {
          /* ignore bad header */
        }
      }

      return { buffer, usage };
    },
    [primePipeline],
  );

  /**
   * Starts playback of the next item in the queue if available.
   * Handles playback state, event dispatching, and queue progression.
   */
  const maybeStartNext = useCallback(async () => {
    if (isDequeuingRef.current) return;
    if (playQueueRef.current.length === 0) return;

    const ok = await ensurePlaybackReady();
    if (!ok) return;

    isDequeuingRef.current = true;
    const ctx = ctxRef.current!;
    const master = masterGainRef.current!;
    const item = playQueueRef.current.shift()!;
    const { buffer, baseMessageId, isHandsfree, lastChunk, onComplete } = item;

    const node = ctx.createBufferSource();
    node.buffer = buffer;
    // Ensure playbackRate is fixed at 1 to avoid accidental speed changes.
    try {
      node.playbackRate.value = 1;
    } catch {}

    const clipGain = ctx.createGain();
    node.connect(clipGain);
    clipGain.connect(master);

    const now = ctx.currentTime;
    const SAFETY = isMobile() ? 0.02 : 0.01;
    const FADE_IN = 0.005;
    const TAIL_PAD = 0.03;

    const startAt = now + SAFETY;
    const endAt = startAt + buffer.duration;
    const preAt = Math.max(now, startAt - 0.01);

    try {
      clipGain.gain.cancelScheduledValues(0);
      clipGain.gain.setValueAtTime(0.0001, preAt);
      clipGain.gain.linearRampToValueAtTime(1.0, startAt + FADE_IN);
      clipGain.gain.setValueAtTime(1.0, endAt);
      clipGain.gain.linearRampToValueAtTime(0.0001, endAt + TAIL_PAD);
    } catch {}

    const wasIdle = currentNodeRef.current == null;
    currentNodeRef.current = node;

    // Ensure the HTMLAudioElement is unmuted and actively playing before dispatching
    // the "tts-playback-started" event. This helps Safari/iOS where routing audio
    // through a MediaStreamAudioDestinationNode -> HTMLAudioElement may remain silent
    // unless the element is actually playing/unmuted after a user gesture.
    const el = audioRef.current;
    if (wasIdle && el) {
      // Only unmute / call play if the <audio> element actually has a stream attached.
      // On Android we do not attach a stream (we output to ctx.destination) so we must
      // not attempt to unmute / play the element — doing so can trigger odd behaviour.
      const hasStream = !!getStreamFromAudio(el);
      if (hasStream) {
        try {
          el.muted = false;
          el.volume = 1;
          // attempt to play; if autoplay policy blocks it the call will throw which we catch.
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          await el.play().catch(() => {});
        } catch {}
      }
    }

    if (wasIdle) {
      window.dispatchEvent(new Event("tts-started-flag"));
      setIsPlaying(true);
      setCurrentMessageId(baseMessageId);

      const el2 = audioRef.current;
      const vizStream = streamDestRef.current?.stream ?? null;

      // 1) If the real <audio> element has a MediaStream attached, dispatch that element
      //    so existing non-Android logic remains unchanged.
      if (el2 && getStreamFromAudio(el2)) {
        queueMicrotask(() =>
          window.dispatchEvent(
            new CustomEvent<HTMLAudioElement>("tts-playback-started", {
              detail: el2,
            }),
          ),
        );
      } else if (vizStream) {
        // 2) Otherwise, if we have a visual stream (streamDest), dispatch a tiny fake
        //    element-like object whose `srcObject` is that stream so MicButton receives it.
        const fakeEl = { srcObject: vizStream } as unknown as HTMLAudioElement;
        queueMicrotask(() =>
          window.dispatchEvent(
            new CustomEvent<HTMLAudioElement>("tts-playback-started", {
              detail: fakeEl,
            }),
          ),
        );
      }
    }

    node.onended = () => {
      try {
        clipGain.disconnect();
      } catch {}
      if (currentNodeRef.current === node) currentNodeRef.current = null;

      if (lastChunk && onComplete) {
        setTimeout(() => onComplete?.(), 50);
      }

      if (playQueueRef.current.length === 0) {
        setIsPlaying(false);
        setCurrentMessageId(null);
        if (isHandsfree) {
          setTimeout(
            () => window.dispatchEvent(new Event("tts-oncomplete")),
            50,
          );
        }
        // re-mute the audio element to leave the audio system quiet when nothing is playing
        try {
          const el3 = audioRef.current;
          if (el3) {
            el3.muted = true;
            el3.volume = 0;
          }
        } catch {}
      }

      isDequeuingRef.current = false;

      queueMicrotask(() => {
        void maybeStartNext();
      });
    };

    try {
      node.start(startAt);
    } catch (e) {
      console.error("Failed to start buffer", e);
      isDequeuingRef.current = false;
      currentNodeRef.current = null;
      queueMicrotask(() => {
        void maybeStartNext();
      });
      return;
    }
  }, [audioRef, ensurePlaybackReady]);

  /**
   * Enqueues an AudioBuffer for playback with associated options.
   * Triggers playback if not already in progress.
   */
  const enqueueBuffer = useCallback(
    async (
      buffer: AudioBuffer,
      opts: {
        isHandsfree: boolean;
        onComplete?: () => void;
        baseMessageId: string;
        lastChunk: boolean;
      },
    ) => {
      playQueueRef.current.push({
        buffer,
        baseMessageId: opts.baseMessageId,
        isHandsfree: opts.isHandsfree,
        lastChunk: opts.lastChunk,
        onComplete: opts.onComplete,
      });
      void maybeStartNext();
    },
    [maybeStartNext],
  );

  /**
   * Primes the audio pipeline and ensures playback is ready.
   * Useful for preparing the player before actual playback.
   */
  const prime = useCallback(async () => {
    await primePipeline();
    await ensurePlaybackReady();
  }, [primePipeline, ensurePlaybackReady]);

  /**
   * Plays the given text as TTS audio, chunking if necessary.
   * Handles queueing, playback, and usage metrics aggregation.
   */
  const playTTS = useCallback(
    async (
      messageId: string,
      text: string,
      isHandsfree = false,
      onComplete?: () => void,
    ): Promise<AudioUsage> => {
      if (currentMessageId === messageId && isPlaying) return null;

      const ok = await ensurePlaybackReady();
      if (!ok) return null;

      const [introChunk, remainder] = chunkTextForTTS(text);

      const introId = `${messageId}-0`;
      const remainderId = `${messageId}-1`;

      const introP = fetchAndDecode(introId, introChunk);
      const remainderP = remainder
        ? fetchAndDecode(remainderId, remainder)
        : Promise.resolve(null);

      const intro = await introP;
      if (!intro?.buffer) {
        console.error("Missing audio for intro chunk:", introId);
        return intro?.usage ?? null;
      }

      await enqueueBuffer(intro.buffer, {
        isHandsfree: !remainder && isHandsfree,
        onComplete: !remainder ? onComplete : undefined,
        baseMessageId: messageId,
        lastChunk: !remainder,
      });

      if (remainder) {
        const rem = await remainderP;
        if (!rem?.buffer) {
          console.error("Missing audio for remainder chunk:", remainderId);
          if (isHandsfree) window.dispatchEvent(new Event("tts-oncomplete"));
          return intro.usage ?? null;
        }

        await enqueueBuffer(rem.buffer, {
          isHandsfree,
          onComplete,
          baseMessageId: messageId,
          lastChunk: true,
        });
      }

      const cost =
        (intro?.usage?.audioUsage.cost ?? 0) +
        ((await remainderP)?.usage?.audioUsage.cost ?? 0);
      const char_count =
        (intro?.usage?.audioUsage.char_count ?? 0) +
        ((await remainderP)?.usage?.audioUsage.char_count ?? 0);
      const a = intro?.usage?.audioUsage.latency;
      const b = (await remainderP)?.usage?.audioUsage.latency;

      let latency = 0;
      if (a != null && b != null) latency = Math.round((a + b) / 2);
      else if (a != null) latency = a;
      else if (b != null) latency = b;

      return intro.usage || b != null || cost || char_count
        ? { audioUsage: { cost, char_count, latency } }
        : null;
    },
    [
      currentMessageId,
      isPlaying,
      fetchAndDecode,
      enqueueBuffer,
      ensurePlaybackReady,
    ],
  );

  /**
   * Stops TTS playback and tears down the audio pipeline.
   * Pauses the audio element if present.
   */
  const stopTTS = useCallback(() => {
    teardownPipeline();
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
      } catch {}
    }
  }, [teardownPipeline, audioRef]);

  return {
    audioRef,
    isPlaying,
    currentMessageId,
    playTTS,
    stopTTS,
    prime,
  };
}
