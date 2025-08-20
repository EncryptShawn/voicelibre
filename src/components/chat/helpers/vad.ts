// src/components/chat/helpers/vad.ts

// Voice Activity Detection (VAD) utility for detecting speech activity.
// This module starts microphone input, monitors audio levels, and invokes
// `onStart` when speech is detected and `onStop` after a period of silence.
// Used in `MicButton` to trigger handsfree recording mode and control speech capture flow.
//################

// Starts VAD by initializing audio stream, setting up analysis loop, and returning a stop function.
// Called from: components/chat/MicButton.tsx
export function startVAD({
  onStart,
  onStop,
  silenceDuration = 2000,
  volumeThreshold = 10,
}: {
  onStart: () => void;
  onStop: () => void;
  silenceDuration?: number;
  volumeThreshold?: number;
}): () => void {
  let audioContext: AudioContext;
  let analyser: AnalyserNode;
  let dataArray: Uint8Array;
  let source: MediaStreamAudioSourceNode;
  let stream: MediaStream;
  let isSpeaking = false;
  let silenceTimer: number | null = null;
  let stopped = false;
  let rafId: number | null = null;

  const stop = () => {
    stopped = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    try {
      if (audioContext?.state !== "closed") void audioContext.close();
    } catch {}
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    if (silenceTimer) clearTimeout(silenceTimer);
  };

  const loop = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(dataArray);
    const rms = Math.sqrt(
      dataArray.reduce((sum, val) => sum + Math.pow(val - 128, 2), 0) /
        dataArray.length,
    );

    const isLoud = rms > volumeThreshold;

    if (isLoud) {
      if (!isSpeaking) {
        isSpeaking = true;
        onStart();
      }
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(() => {
        if (isSpeaking && !stopped) {
          isSpeaking = false;
          onStop();
        }
      }, silenceDuration);
    }
    rafId = requestAnimationFrame(loop);
  };

  const init = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      audioContext = new AudioContext({ latencyHint: "interactive" });
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.fftSize);
      rafId = requestAnimationFrame(loop);
    } catch (error) {
      console.error("VAD initialization failed:", error);
    }
  };

  void init();

  return stop;
}
