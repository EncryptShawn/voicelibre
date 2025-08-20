// src/components/bottomBar/hooks/useResponderModels.ts
//
// Summary:
// Provides a React hook `useResponderModels` that fetches available AI models,
// voice-capable models, and available voices from the application's model APIs.
// It normalizes and exposes three sets of data for the responder editing UI:
//  - aiModels: general AI models from the model pool
//  - voiceModels: filtered voice-capable models suitable for TTS providers
//  - voices: concrete voice entries for a specific voice_model selection
//
// Imports to:
// - Imported by responder-related UI components (e.g. EditResponderModal and ModelCombo)
//
// Exports:
// - export function useResponderModels(selectedVoiceModel: string)
//
// Exports used by:
// - src/components/bottomBar/modals/EditResponderModal.tsx
// - src/components/bottomBar/modals/ModelCombo.tsx
//
// Nuances:
// - The hook uses a small in-memory cache (voicesCache) keyed by "provider/model"
//   to avoid recalculating voice lists for the same voice model selection.
// - Voice model latency values are parsed from a slash-delimited string and the
//   hook falls back to "N/A" when latency information is missing.
// - The hook tolerates malformed API responses by defensive runtime checks and
//   surfaces errors via the returned `error` value; callers should read `isLoading`
//   and `error` to manage UI state.
// - This file intentionally keeps logic focused on fetching/normalizing model data.
//   UI behaviors and selection state are managed by the consuming components.

import { useEffect, useState } from "react";

type Model = {
  provider: string;
  model: string;
  avg_cost: string;
  latency: string;
};

type Voice = {
  provider: string;
  model: string;
  voice_id: string;
  name: string;
};

const allowedVoiceModels = [
  "openai/tts-1-hd",
  "openai/tts-1-1106",
  "openai/gpt-4o-mini-tts",
  "openai/gpt-4o-tts",
  "elevenlabs/eleven-multilingual-v1",
  "elevenlabs/eleven-multilingual-v2",
  "elevenlabs/eleven-turbo-v2-5",
  "elevenlabs/eleven-flash-v2-5",
];

const voicesCache: Record<string, Voice[]> = {};

/**
 * useResponderModels
 *
 * Summary:
 * Hook that fetches and exposes AI model lists and voice definitions used by the
 * responder editor UI. It fetches:
 *  - /api/models?provider=pool       -> pool of general AI models
 *  - /api/models?type=voice         -> provider/model entries that support TTS
 *  - /api/models?voices             -> concrete voice entries (voice_id, name, provider, model)
 *
 * Returns:
 *  - aiModels: Model[]           -> normalized model entries for model selection
 *  - voiceModels: Model[]        -> filtered voice-capable models suitable for voice selection
 *  - voices: Voice[]             -> concrete voices for the currently selected voice_model
 *  - isLoading: boolean          -> loading state while fetching
 *  - error: Error | null         -> any error encountered while fetching
 *
 * Responsibilities:
 *  - Fetch model and voice data in parallel on mount.
 *  - Normalize latency values to a friendly string.
 *  - Provide a cached lookup of voices per "provider/model" to avoid re-filtering.
 *  - Keep the hook focused on data acquisition and normalization — selection UI
 *    state and persistence are the caller's responsibility.
 *
 * Nuances:
 *  - The hook performs defensive runtime checks on the API response shapes to avoid
 *    throwing when APIs return unexpected data. Consumers should check `isLoading`
 *    and `error` before rendering dependent UI.
 *  - Caching is in-memory for the session only and is keyed by `${provider}/${model}`.
 */
export function useResponderModels(selectedVoiceModel: string) {
  const [aiModels, setAiModels] = useState<Model[]>([]);
  const [voiceModels, setVoiceModels] = useState<Model[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesData, setVoicesData] = useState<Voice[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const [poolRes, voiceRes, voicesRes]: [Response, Response, Response] =
          await Promise.all([
            fetch("/api/models?provider=pool"),
            fetch("/api/models?type=voice"),
            fetch("/api/models?voices"),
          ]);

        if (!poolRes.ok || !voiceRes.ok || !voicesRes.ok) {
          throw new Error("Failed to fetch model data");
        }

        const poolDataRaw = (await poolRes.json()) as unknown;
        const voiceDataRaw = (await voiceRes.json()) as unknown;
        const voicesRaw = (await voicesRes.json()) as unknown;

        const poolData = Array.isArray(poolDataRaw)
          ? (poolDataRaw as Model[])
          : [];

        const voiceData = Array.isArray(voiceDataRaw)
          ? (voiceDataRaw as Model[])
          : [];

        const voicesJson = Array.isArray(voicesRaw) ? voicesRaw : [];

        setAiModels(
          poolData.map((m) => ({
            provider: m.provider,
            model: m.model,
            avg_cost: m.avg_cost,
            latency: (() => {
              if (!m.latency) return "?";
              const parts = m.latency.split("/");
              const val = parts[parts.length - 1]; // 👈 grab last value (7th)
              return val && /^\d+$/.test(val) ? val : "?";
            })(),
          })),
        );

        const filteredVoiceModels = voiceData
          .filter((m) =>
            allowedVoiceModels.includes(`${m.provider}/${m.model}`),
          )
          .map((m) => ({
            provider: m.provider,
            model: m.model,
            avg_cost: m.avg_cost,
            latency: (() => {
              if (!m.latency) return "?";
              const parts = m.latency.split("/");
              const val = parts[5];
              return val && /^\d+$/.test(val) ? val : "?";
            })(),
          }));

        setVoiceModels(filteredVoiceModels);

        const filteredVoices = voicesJson.filter((v): v is Voice => {
          return (
            typeof v === "object" &&
            v !== null &&
            typeof (v as Voice).voice_id === "string" &&
            typeof (v as Voice).name === "string" &&
            typeof (v as Voice).provider === "string" &&
            typeof (v as Voice).model === "string"
          );
        });

        setVoicesData(filteredVoices);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setIsLoading(false);
      }
    };

    void fetchModels();
  }, []);

  useEffect(() => {
    if (!selectedVoiceModel || voicesData.length === 0) {
      setVoices([]);
      return;
    }

    const [provider, modelName]: [string, string] = selectedVoiceModel.split(
      "/",
    ) as [string, string];
    const cacheKey = `${provider}/${modelName}`;

    if (voicesCache[cacheKey]) {
      setVoices(voicesCache[cacheKey]);
      return;
    }

    const filtered = voicesData.filter(
      (v) => v.provider === provider && v.model === modelName,
    );

    voicesCache[cacheKey] = filtered;
    setVoices(filtered);
  }, [selectedVoiceModel, voicesData]);

  return { aiModels, voiceModels, voices, isLoading, error };
}
