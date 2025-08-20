// src/components/bottomBar/MemoryToggle.tsx
/**
 * Memory toggle component for the bottom bar that controls conversation memory features.
 * Provides a button that can be clicked to toggle memory on/off, or long-pressed to show
 * a menu with Clear and Re-remember options. Integrates with the chat system's memory
 * functionality through callbacks and displays visual state through icon colors.
 * Used by BottomBar component and communicates with memory hooks and chat API.
 */

import { useState, useRef, useEffect } from "react";
import { MemoryIcon } from "~/components/icons";

type MemoryToggleProps = {
  isActive: boolean;
  showMenu: boolean;
  onToggle: (isActive: boolean) => void;
  onClear: () => void;
  onReRemember: () => void;
  onPressStart: () => void;
  onPressEnd: () => void;
  theme: "light" | "dark";
  onToast: (msg: string) => void;
};

export function MemoryToggle({
  isActive,
  showMenu,
  onClear,
  onReRemember,
  onPressStart,
  onPressEnd,
  theme,
}: MemoryToggleProps) {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const memoryMenuRef = useRef<HTMLUListElement>(null);
  const memoryMenuCloseTimer = useRef<NodeJS.Timeout | null>(null);

  const handlePressStart = () => {
    const timer = setTimeout(() => {
      onPressStart();
    }, 500);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    onPressEnd();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showMenu &&
        memoryMenuRef.current &&
        !memoryMenuRef.current.contains(event.target as Node)
      ) {
        onPressEnd();
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      memoryMenuCloseTimer.current = setTimeout(() => onPressEnd(), 5000);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (memoryMenuCloseTimer.current) {
        clearTimeout(memoryMenuCloseTimer.current);
        memoryMenuCloseTimer.current = null;
      }
    };
  }, [showMenu, onPressEnd]);

  return (
    <div className="relative">
      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <MemoryIcon
          className={`relative top-[3px] h-9 w-9 ${
            isActive
              ? "text-green-500"
              : theme === "dark"
                ? "text-foreground"
                : "text-cyan-600"
          }`}
        />
      </button>

      {showMenu && (
        <ul
          ref={memoryMenuRef}
          className="absolute bottom-full z-50 mb-1 w-max min-w-[120px] rounded shadow"
          style={{
            backgroundColor: "rgb(var(--header-footer-bg))",
            border: "1px solid rgba(var(--secondary), 0.1)",
            color: "rgb(var(--foreground))",
          }}
        >
          <li
            onClick={() => {
              onClear();
              if (memoryMenuCloseTimer.current) {
                clearTimeout(memoryMenuCloseTimer.current);
                memoryMenuCloseTimer.current = null;
              }
              onPressEnd();
            }}
            className="cursor-pointer px-2 py-1 text-base"
            style={{
              color: "rgb(var(--foreground))",
            }}
          >
            Clear
          </li>
          <li
            onClick={() => {
              onReRemember();
              if (memoryMenuCloseTimer.current) {
                clearTimeout(memoryMenuCloseTimer.current);
                memoryMenuCloseTimer.current = null;
              }
              onPressEnd();
            }}
            className="cursor-pointer px-2 py-1 text-base"
            style={{
              color: "rgb(var(--foreground))",
            }}
          >
            Re-remember
          </li>
        </ul>
      )}
    </div>
  );
}
