// src/components/bottomBar/HandsfreeToggle.tsx
//
//Toggle swtich for hands free switch

import { useState, useRef } from "react";
import { HandsfreeIcon } from "~/components/icons";

type HandsfreeToggleProps = {
  isActive: boolean;
  onToggle: (active: boolean) => void;
  theme: "light" | "dark";
  onToast: (msg: string) => void;
};

export function HandsfreeToggle({
  isActive,
  onToggle,
  theme,
  onToast,
}: HandsfreeToggleProps) {
  const [, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    const newActive = !isActive;
    onToggle(newActive);
    onToast(newActive ? "Handsfree enabled" : "Handsfree disabled");
  };

  const handleMouseEnter = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    tooltipTimeout.current = setTimeout(() => {
      setShowTooltip(false);
    }, 300);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <HandsfreeIcon
          className={`relative top-[-1px] h-9 w-9 ${
            isActive
              ? "text-green-500"
              : theme === "dark"
                ? "text-foreground"
                : "text-cyan-600"
          }`}
        />
      </button>
    </div>
  );
}
