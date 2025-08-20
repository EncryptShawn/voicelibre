// src/components/bottomBar/modals/EditResponderModal.tsx
//
// Summary:
// EditResponderModal is a modal UI component used to create or edit a "responder" — a configured
// assistant persona with model, voice, prompt, and memory settings. The modal provides form
// fields for name, AI model, voice model, voice selection, prompt text, response length, and
// memory sliders. It validates form values using responderSchema, issues POST (create) or PATCH
// (update) requests to /api/responders, and calls the provided onSave/onClose callbacks with the
// result. The component relies on useResponderModels to populate model and voice lists.
//
// Imports to:
// - src/app/chat/page.tsx
//
// Exports:
// - export function EditResponderModal(props: Props) (React component)
//
// Exports used by:
// - src/app/chat/page.tsx (renders the modal when editingResponder state is set)
//
// Nuances:
// - The component enforces a 10-character limit on the responder name input (UI-side).
// - Validation is delegated to responderSchema (zod); validation errors surface via simple
//   alert(...) calls in the UI flow.
// - When creating a new responder (responder.id === -1 or non-number), the component POSTs to
//   /api/responders and expects the created responder object back. For updates it PATCHes the
//   resource at /api/responders/:name and calls onSave with the merged result.
// - The component attempts to select a previously chosen voice once the voice list loads by
//   checking voices returned from useResponderModels.
// - Keep heavy business logic out of this component; it is intended to be a presentational + form
//   orchestration layer. Significant behaviors (fetching models/voices) are in useResponderModels.
//
// Note: Follow project documentation standards — major exported functions have descriptive
// documentation and the file top contains path + a top-level Summary/Imports/Exports/Nuances block.
// Avoid trivial inline comments inside functions; comments should explain the purpose of blocks.
import { useState, useEffect } from "react";
import { z } from "zod";
import { useTheme } from "~/lib/theme-provider";
import { ModelCombo } from "./ModelCombo";
import { VoiceSelector } from "./VoiceSelector";
import { useResponderModels } from "../hooks/useResponderModels";
import { responderSchema } from "../schemas/responderSchema";
import { getMemoryLabel, getExpirationLabel } from "../utils/memoryLabelUtils";

type Responder = {
  id: number;
  name: string;
  model: string;
  voice_model: string | null;
  voice: string | null;
  max_tokens: number | null;
  owner: string;
  prompt: string;
  short_mem?: number;
  long_mem?: number;
  mem_expire?: number;
};

export type Model = {
  provider: string;
  model: string;
  avg_cost: string;
  latency: string;
};

export type Voice = {
  provider: string;
  model: string;
  voice_id: string;
  name: string;
};

type Props = {
  responder: Responder;
  onClose: () => void;
  onSave: (updatedResponder: Responder) => void;
};

/**
 * EditResponderModal
 *
 * Presents a modal that allows creating or editing a responder configuration.
 *
 * Responsibilities:
 * - Render form controls for responder name, AI model, voice model, voice, prompt,
 *   response length, and memory controls.
 * - Use useResponderModels to populate model/voice lists.
 * - Validate form data via responderSchema prior to sending to the API.
 * - On successful create/update, invoke onSave(...) with the created/updated Responder.
 *
 * Props:
 * - responder: initial responder values (use id === -1 for "create new")
 * - onClose: close the modal without saving
 * - onSave: callback invoked with the saved Responder on success
 */
export function EditResponderModal({ responder, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const [responderName, setResponderName] = useState(responder.name ?? "");
  const [selectedModel, setSelectedModel] = useState(responder.model ?? "");
  const [selectedVoiceModel, setSelectedVoiceModel] = useState(
    responder.voice_model ?? "",
  );
  const [selectedVoice, setSelectedVoice] = useState(responder.voice ?? "");
  const [responseLength, setResponseLength] = useState(
    responder.max_tokens ? Math.floor(responder.max_tokens / 100) : 3,
  );
  const [promptText, setPromptText] = useState(responder.prompt ?? "");
  const [shortMem, setShortMem] = useState(responder.short_mem ?? 3);
  const [longMem, setLongMem] = useState(responder.long_mem ?? 2);
  const [memExpire, setMemExpire] = useState(responder.mem_expire ?? 1440);

  const { aiModels, voiceModels, voices } =
    useResponderModels(selectedVoiceModel);

  /**
   * Synchronize selectedVoice once the voices list becomes available.
   * If the original responder voice exists in the fetched voices, prefer that.
   */
  useEffect(() => {
    if (
      responder.voice &&
      selectedVoice === "" &&
      voices.length > 0 &&
      voices.some((v) => v.voice_id === responder.voice)
    ) {
      setSelectedVoice(responder.voice);
    }
  }, [voices, responder.voice, selectedVoice]);

  /**
   * handleSave
   *
   * Validate UI inputs, construct payload, and either create or update the responder
   * by calling the server. Uses responderSchema (zod) for validation. On success calls
   * the onSave callback with the created/updated Responder.
   *
   * Note: This function surfaces validation and API errors using alert(...) in the UI.
   */
  const handleSave = async () => {
    if (!responderName.trim()) {
      alert("Name is required");
      return;
    }

    try {
      const validated = responderSchema.parse({
        model: selectedModel,
        voice_model: selectedVoiceModel,
        voice: selectedVoice,
        max_tokens: responseLength * 100,
        prompt: promptText,
        short_mem: shortMem,
        long_mem: longMem,
        mem_expire: memExpire,
      });

      const newResponderData = {
        ...validated,
        name: responderName.trim(),
      } satisfies Partial<Responder>;

      if (typeof responder.id !== "number" || responder.id === -1) {
        const res = await fetch("/api/responders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newResponderData),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          alert(err.error ?? "Failed to create responder");
          return;
        }

        const created = (await res.json()) as Responder;
        onSave(created);
      } else {
        const res = await fetch(`/api/responders/${responder.name}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newResponderData),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          alert(err.error ?? "Failed to update responder");
          return;
        }

        onSave({ ...responder, ...newResponderData });
      }
    } catch (error) {
      if (error instanceof z.ZodError && error.errors?.[0]?.message) {
        alert(error.errors[0].message);
      } else {
        alert("An unknown error occurred");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-sm flex-col rounded-md p-4 shadow-md"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor:
            theme === "dark" ? "rgb(var(--header-footer-bg))" : "#f9f9f9",
          color: "rgb(var(--foreground))",
          border: "1px solid rgba(var(--secondary), 0.1)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <h2 className="mb-3 text-lg font-semibold">Edit Responder</h2>
          <div className="mb-3">
            <label className="mb-0.5 block text-sm">Name</label>
            <input
              type="text"
              value={responderName}
              onChange={(e) => setResponderName(e.target.value.slice(0, 10))}
              className="w-full rounded border p-2 text-sm"
              placeholder="Enter name"
              style={{
                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                color: theme === "dark" ? "#ffffff" : "#000000",
              }}
            />
          </div>

          <ModelCombo
            models={aiModels}
            selected={selectedModel}
            setSelected={setSelectedModel}
            label="AI Model"
          />

          <ModelCombo
            models={voiceModels}
            selected={selectedVoiceModel}
            setSelected={setSelectedVoiceModel}
            label="Voice Model"
          />

          <VoiceSelector
            voices={voices}
            selectedVoice={selectedVoice}
            onChange={setSelectedVoice}
            disabled={!selectedVoiceModel}
          />

          <div className="mt-4">
            <label className="mb-0.5 block text-sm">Prompt</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={4}
              className="w-full rounded border p-2 text-sm"
              style={{
                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                color: theme === "dark" ? "#ffffff" : "#000000",
              }}
            />
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="mb-0.5 block text-sm">
                Response Length:{" "}
                {
                  ["Brief", "Short", "Medium", "Long", "Verbose"][
                    responseLength - 1
                  ]
                }
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={responseLength}
                onChange={(e) => setResponseLength(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "rgb(var(--primary))" }}
              />
              <span>{responseLength * 100} tokens</span>
            </div>

            <div>
              <label className="mb-0.5 block text-sm">
                Short-Term Memory: {getMemoryLabel(shortMem, "short")}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={shortMem}
                onChange={(e) => setShortMem(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "rgb(var(--primary))" }}
              />
            </div>

            <div>
              <label className="mb-0.5 block text-sm">
                Long-Term Memory: {getMemoryLabel(longMem, "long")}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={longMem}
                onChange={(e) => setLongMem(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "rgb(var(--primary))" }}
              />
            </div>

            <div>
              <label className="mb-0.5 block text-sm">
                Memory Expiration: {getExpirationLabel(memExpire)}
              </label>
              <input
                type="range"
                min={30}
                max={1440}
                value={memExpire}
                onChange={(e) => setMemExpire(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "rgb(var(--primary))" }}
              />
            </div>
          </div>
        </div>

        <div className="bg-opacity-80 mt-6 flex shrink-0 justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm"
            style={{
              backgroundColor: "#ddd",
              color: "#333",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded px-4 py-2 text-sm"
            style={{
              backgroundColor: "#007bff",
              color: "#fff",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
