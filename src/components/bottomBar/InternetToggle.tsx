// src/components/bottomBar/InternetToggle.tsx
//
// Internet search toggle component for the bottom bar
// Provides toggle functionality for enabling/disabling web search with context size selection
// Integrates with BottomBar parent component and communicates search state changes to chat system

import { useState, useRef, useEffect } from "react";
import { InternetIcon } from "~/components/icons";

type InternetToggleProps = {
  isActive: boolean;
  onToggle: (
    isActive: boolean,
    contextSize?: "low" | "medium" | "high",
  ) => void;
  contextSize: "low" | "medium" | "high";
  onSizeChange: (size: "low" | "medium" | "high") => void;
  theme: "light" | "dark";
  onToast: (msg: string) => void;
};

// Main component exported to src/components/bottomBar/BottomBar.tsx
// Renders internet search toggle button with context size selection menu
// handle single click toggle and long hold menu
export function InternetToggle({
  isActive,
  onToggle,
  contextSize,
  onSizeChange,
  theme,
  onToast,
}: InternetToggleProps) {
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const sizeMenuRef = useRef<HTMLUListElement>(null);
  const sizeMenuCloseTimer = useRef<NodeJS.Timeout | null>(null);

  // Handles single click to toggle internet search on/off
  const handleClick = () => {
    const newActive = !isActive;
    onToggle(newActive, newActive ? contextSize : undefined);
    onToast(newActive ? "Internet search enabled" : "Internet search disabled");
  };

  // Initiates long press detection to show context size menu
  const handlePressStart = () => {
    const timer = setTimeout(() => {
      setShowSizeMenu(true);
    }, 500);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  // Handles selection of context size from dropdown menu
  const selectSize = (size: "low" | "medium" | "high") => {
    onSizeChange(size);
    setShowSizeMenu(false);
    const shouldActivate = !isActive;
    if (shouldActivate) {
      onToggle(true, size);
    }
    if (sizeMenuCloseTimer.current) {
      clearTimeout(sizeMenuCloseTimer.current);
      sizeMenuCloseTimer.current = null;
    }
  };

  // Effect hook for handling click outside menu and auto-close timer
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSizeMenu &&
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(event.target as Node)
      ) {
        setShowSizeMenu(false);
      }
    };

    if (showSizeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      sizeMenuCloseTimer.current = setTimeout(
        () => setShowSizeMenu(false),
        5000,
      );
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (sizeMenuCloseTimer.current) {
        clearTimeout(sizeMenuCloseTimer.current);
        sizeMenuCloseTimer.current = null;
      }
    };
  }, [showSizeMenu]);

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <InternetIcon
          className={`relative top-[3px] h-9 w-9 ${
            isActive
              ? "text-green-500"
              : theme === "dark"
                ? "text-foreground"
                : "text-cyan-600"
          }`}
        />
      </button>
      {showSizeMenu && (
        <ul
          ref={sizeMenuRef}
          className="absolute bottom-full z-50 mb-1 w-max min-w-[120px] rounded shadow"
          style={{
            backgroundColor: "rgb(var(--header-footer-bg))",
            border: "1px solid rgba(var(--secondary), 0.1)",
            color: "rgb(var(--foreground))",
          }}
        >
          {["low", "medium", "high"].map((level) => (
            <li
              key={level}
              onClick={() => selectSize(level as "low" | "medium" | "high")}
              className="cursor-pointer px-2 py-1 text-base transition-colors duration-100 hover:bg-gray-200 active:bg-gray-300"
              style={{
                color: "rgb(var(--foreground))",
              }}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
