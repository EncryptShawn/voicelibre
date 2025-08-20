// src/components/bottomBar/ResponderSelector.tsx
//
// Summary:
// ResponderSelector renders the responder selection control used in the BottomBar.
// It displays the currently selected responder and provides a dropdown menu to:
//   - switch the active responder
//   - edit an existing responder (if owner or admin)
//   - delete user-owned responders
//   - create a new responder
//
// Imports to:
// - Used by src/components/bottomBar/BottomBar.tsx to present responder options in the chat UI.
//
// Exports:
// - export function ResponderSelector(props: ResponderSelectorProps)
//
// Exports used by:
// - src/components/bottomBar/BottomBar.tsx
//
// Nuances:
// - The component performs a lightweight session fetch to determine admin privileges
//   so edit controls for system-owned responders are conditionally shown.
// - UI-only component: side-effectful behavior (persisting edits/deletes) is delegated
//   to handlers passed via props (onEdit, onDelete, onSelect).
// - Keep comments high-level and avoid inline/trivial comments inside function bodies.
import { useState, useRef, useEffect } from "react";
import { useTheme } from "~/lib/theme-provider";
import type { Responder } from "~/types/responder";
import { EditIcon } from "~/components/icons";
import Image from "next/image";

type ResponderSelectorProps = {
  selectedResponder: string;
  onSelect: (name: string) => void;
  onEdit: (responder: Responder) => void;
  onDelete: (name: string) => void;
  onToast: (message: string) => void;
  responders: Responder[];
};

type SessionResponse = {
  user?: {
    admin?: boolean;
  };
};

/**
 * ResponderSelector
 *
 * Renders the responder dropdown used by the BottomBar. Responsibilities:
 * - Show the currently selected responder name.
 * - Open a menu listing available responders.
 * - Invoke onSelect(name) when a responder is chosen.
 * - Invoke onEdit(responder) when the edit button is clicked (edit UI handled by parent).
 * - Invoke onDelete(name) when the delete control is used (parent handles confirmation/side-effects).
 *
 * Notes:
 * - This component only manages menu visibility and user interactions. It fetches the
 *   current session to determine admin status solely for UI permission checks.
 * - Do not add business logic here; keep side effects in the parent or provided handlers.
 */
export function ResponderSelector({
  selectedResponder,
  onSelect,
  onEdit,
  onDelete,
  responders,
}: ResponderSelectorProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);
  const { theme } = useTheme();
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const session = (await res.json()) as SessionResponse;
        setUserIsAdmin(session?.user?.admin === true);
      } catch {
        setUserIsAdmin(false);
      }
    };
    void fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        open &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      closeTimer.current = setTimeout(() => setOpen(false), 5000);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open]);

  return (
    <div className="relative z-[60]" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-sm"
        style={{
          backgroundColor: "rgb(var(--header-footer-bg))",
          color: "rgb(var(--foreground))",
        }}
      >
        <Image src="/img/profile.png" alt="User" width={18} height={18} />
        <span className="text-base">{selectedResponder}</span>
        <span className="text-xs text-gray-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul
          className="absolute bottom-full z-[60] mb-1 w-max min-w-[135px] rounded shadow"
          style={{
            backgroundColor: "rgb(var(--header-footer-bg))",
            border: "1px solid rgba(var(--secondary), 0.1)",
            color: "rgb(var(--foreground))",
          }}
        >
          {responders.map((responder: Responder) => {
            const normalized: Responder = {
              ...responder,
              short_mem: responder.short_mem ?? undefined,
              long_mem: responder.long_mem ?? undefined,
              mem_expire: responder.mem_expire ?? undefined,
            };
            return (
              <li
                key={normalized.id}
                className={`flex cursor-pointer items-center justify-between px-2 py-1 text-base transition-colors duration-100 ${
                  normalized.name === selectedResponder
                    ? "bg-cyan-500 text-white dark:bg-cyan-600"
                    : "hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                <span
                  onClick={() => {
                    onSelect(normalized.name);
                    setOpen(false);
                  }}
                >
                  {normalized.name}
                </span>
                <div className="flex items-center gap-1">
                  {(normalized.owner !== "system" || userIsAdmin) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(normalized);
                      }}
                      className="p-1 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <EditIcon
                        className="h-4 w-4"
                        style={{
                          color:
                            normalized.name === selectedResponder
                              ? "white"
                              : theme === "dark"
                                ? "white"
                                : "black",
                        }}
                      />
                    </button>
                  )}
                  {normalized.owner !== "system" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(`responder:${normalized.name}`);
                      }}
                      className="p-1 text-white hover:text-gray-200"
                    >
                      ❌
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          <li
            className="flex items-center justify-center px-2 py-1 text-base hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-700"
            onClick={() => {
              onEdit({
                id: -1,
                name: "",
                model: "",
                voice: null,
                voice_model: null,
                prompt: "",
                max_tokens: 300,
                owner: "user",
              });
              setOpen(false);
            }}
          >
            <span className="text-xl !text-green-500">➕</span>
          </li>
        </ul>
      )}
    </div>
  );
}
