//src/components/bottomBar/modals/modelCombo.tsx
//
//Powers the drop down selectors with seach optiona and autofill on the responder modal.

import { useState, useEffect, useRef } from "react";
import { type Model } from "./EditResponderModal";
import { useTheme } from "~/lib/theme-provider";

export function ModelCombo({
  models,
  selected,
  setSelected,
  label,
}: {
  models: Model[];
  selected: string;
  setSelected: (value: string) => void;
  label: string;
}) {
  const { theme } = useTheme();
  const [input, setInput] = useState(selected);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClear = () => {
    setInput("");
    setSelected("");
  };

  const filtered = models.filter((m: Model) =>
    `${m.provider}/${m.model}`
      .toLowerCase()
      .includes(input.trim().toLowerCase()),
  );

  useEffect(() => {
    setInput(selected);
  }, [selected]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block">{label}</label>
      <div className="relative">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded border p-2 pr-8"
          placeholder="Type to filter..."
          style={{
            backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
            color: theme === "dark" ? "#ffffff" : "#000000",
          }}
        />
        {input && (
          <button
            onClick={handleClear}
            className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
            style={{
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
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
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul
          className={`absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border shadow`}
          style={{
            backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
            color: theme === "dark" ? "#ffffff" : "#000000",
          }}
        >
          {filtered.map((m: Model) => {
            const val = `${m.provider}/${m.model}`;
            return (
              <li
                key={val}
                onClick={() => {
                  setSelected(val);
                  setInput(val);
                  setOpen(false);
                }}
                className="cursor-pointer px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {m.model} | ${parseFloat(m.avg_cost).toFixed(5)} | {m.latency}ms
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
