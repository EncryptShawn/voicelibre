/**
 * src/components/bottomBar/modals/VoiceSelector.tsx
 *
 * Summary:
 * VoiceSelector renders a labeled HTML select element for choosing a TTS voice.
 * It receives a list of available voices and exposes the selected voice id via
 * onChange. The component is intentionally small and purely presentational —
 * all voice listing and selection logic belongs to the parent (e.g. EditResponderModal).
 *
 * Imports to:
 * - Imported and used by src/components/bottomBar/modals/EditResponderModal.tsx
 *
 * Exports:
 * - VoiceSelector (React component)
 *
 * Exports used by:
 * - src/components/bottomBar/modals/EditResponderModal.tsx
 *
 * Nuances:
 * - The option key uses voice.voice_id when available and falls back to a stable
 *   composite key using provider/model/index to avoid React key collisions.
 * - The select's value is the voice_id (empty string denotes "no voice selected").
 * - Keep this component presentational: avoid adding data-fetching or heavy logic here.
 * - Do not add inline comments inside JSX; prefer concise top-level documentation.
 */

import type { Voice } from "./EditResponderModal";

type Props = {
  voices: Voice[];
  selectedVoice: string;
  onChange: (val: string) => void;
  disabled?: boolean;
};

/**
 * VoiceSelector
 *
 * Purpose:
 * - Render a labeled dropdown of voices and notify the parent when the selection changes.
 *
 * Props:
 * - voices: array of Voice objects (provider, model, voice_id, name).
 * - selectedVoice: currently selected voice_id (empty string if none).
 * - onChange: callback invoked with the new voice_id when the user selects an option.
 * - disabled: optional boolean to disable the control.
 *
 * Behavior:
 * - Displays a "Select Voice" placeholder option when selectedVoice is empty.
 * - Each option's value is voice.voice_id; when voice_id is falsy the composite key
 *   provider-model-index is used as the React key to avoid collisions.
 * - Styling is controlled via className and inline style variables so the parent
 *   theme can remain consistent without injecting additional logic here.
 */
export function VoiceSelector({
  voices,
  selectedVoice,
  onChange,
  disabled = false,
}: Props) {
  return (
    <div>
      <label className="mb-0.5 block text-sm">Voice</label>
      <select
        className="w-full rounded border px-2 py-1 text-sm"
        value={selectedVoice}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          backgroundColor: "rgb(var(--header-footer-bg))",
          color: "rgb(var(--foreground))",
          borderColor: "rgba(var(--secondary), 0.1)",
        }}
      >
        <option value="">Select Voice</option>
        {voices.map((voice, idx) => (
          <option
            key={voice.voice_id || `${voice.provider}-${voice.model}-${idx}`}
            value={voice.voice_id}
          >
            {voice.name}
          </option>
        ))}
      </select>
    </div>
  );
}
