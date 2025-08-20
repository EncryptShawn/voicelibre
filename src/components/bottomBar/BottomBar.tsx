// src/components/bottomBar/BottomBar.tsx
//
// Summary:
// BottomBar renders the persistent bottom navigation bar for the chat interface.
// It provides controls for:
//   - Responder selection and editing (ResponderSelector)
//   - Internet / web-search toggle and context-size selection (InternetToggle)
//   - Conversation memory controls: toggle, clear, re-remember (MemoryToggle)
//   - Handsfree mode toggle (HandsfreeToggle)
//   - Saving transcripts (SaveButton)
//
// The component composes those child controls and forwards user interactions to
// the parent via callbacks. It stays presentation-focused and delegates all
// business logic to the props' handlers (typically provided by hooks such as useChat).
//
// Imports to:
// - Rendered by src/app/chat/page.tsx as part of the chat UI composition.
//
// Exports:
// - export function BottomBar(props: Props)
//
// Exports used by:
// - src/app/chat/page.tsx (imports BottomBar to display bottom controls)
//
// Nuances:
// - This module should avoid in-component business logic. Handlers passed via props
//   are responsible for side effects (network requests, state updates, memory ops).
// - Styling relies on CSS variables (e.g. --header-footer-bg, --foreground, --secondary).
// - Keep the component deterministic and easy to test by not introducing local state
//   beyond transient UI concerns; prefer lifting state to the page or hooks.
// - Do not add inline comments inside functions unless conveying a non-obvious, mutable
//   configuration value or rationale.

import { ResponderSelector } from "./ResponderSelector";
import { InternetToggle } from "./InternetToggle";
import { MemoryToggle } from "./MemoryToggle";
import { HandsfreeToggle } from "./HandsfreeToggle";
import { SaveButton } from "./SaveButton";
import type { Responder } from "~/types/responder";

type Props = {
  onInteraction?: () => void;
  onResponderChange: (responderName: string) => void;
  onWebSearchChange: (
    isActive: boolean,
    contextSize?: "low" | "medium" | "high",
  ) => void;
  onPromptChange: (promptName: string) => void;
  onMemoryToggle: (isActive: boolean) => void;
  onMemoryClear: () => void;
  onMemoryReRemember: () => void;
  onSaveClick: () => void;
  isMemoryActive: boolean;
  showMemoryMenu: boolean;
  onMemoryPressStart: () => void;
  onMemoryPressEnd: () => void;
  isHandsfreeActive: boolean;
  onToggleHandsfree: (active: boolean) => void;
  theme: "light" | "dark";
  selectedResponder: string;
  isInternetActive: boolean;
  contextSize: "low" | "medium" | "high";
  onSizeChange: (size: "low" | "medium" | "high") => void;
  onToast: (msg: string) => void;
  setEditingResponder: (responder: Responder | null) => void;
  responders: Responder[];
  onDeleteResponder: (id: string) => void;
};

export function BottomBar({
  onResponderChange,
  onWebSearchChange,
  onMemoryToggle,
  onMemoryClear,
  onMemoryReRemember,
  onSaveClick,
  isMemoryActive,
  showMemoryMenu,
  onMemoryPressStart,
  onMemoryPressEnd,
  isHandsfreeActive,
  onToggleHandsfree,
  theme,
  selectedResponder,
  isInternetActive,
  contextSize,
  onSizeChange,
  onToast,
  setEditingResponder,
  responders,
  onDeleteResponder,
}: Props) {
  return (
    <div
      className="pointer-events-none fixed right-0 left-0 z-[150]"
      style={{
        bottom:
          "calc(env(safe-area-inset-bottom, 0px) + var(--bottom-bar-gap))",
      }}
    >
      <nav
        className="pointer-events-auto flex h-12 items-center justify-between px-4"
        style={{
          backgroundColor: "rgb(var(--header-footer-bg))",
          color: "rgb(var(--foreground))",
          width: "100%",
          borderTop: "1px solid rgba(var(--secondary), 0.1)",
        }}
      >
        <ResponderSelector
          selectedResponder={selectedResponder}
          onSelect={onResponderChange}
          onEdit={(responder: Responder) => {
            const latest = responders.find((r) => r.name === responder.name);
            setEditingResponder(latest ?? responder);
          }}
          onDelete={onDeleteResponder}
          onToast={onToast}
          responders={responders}
        />

        <div className="flex items-center gap-5">
          <InternetToggle
            isActive={isInternetActive}
            contextSize={contextSize}
            onToggle={onWebSearchChange}
            onSizeChange={onSizeChange}
            theme={theme}
            onToast={onToast}
          />
          <MemoryToggle
            isActive={isMemoryActive}
            showMenu={showMemoryMenu}
            onToggle={onMemoryToggle}
            onClear={onMemoryClear}
            onReRemember={onMemoryReRemember}
            onPressStart={onMemoryPressStart}
            onPressEnd={onMemoryPressEnd}
            theme={theme}
            onToast={onToast}
          />
          <div style={{ marginTop: "5px" }}>
            <HandsfreeToggle
              isActive={isHandsfreeActive}
              onToggle={onToggleHandsfree}
              theme={theme}
              onToast={onToast}
            />
          </div>
          <SaveButton onClick={onSaveClick} theme={theme} />
        </div>
      </nav>
    </div>
  );
}
