/**
 * File: src/components/HeaderBar.tsx
 *
 * Summary:
 *   HeaderBar renders the application's top navigation. It displays the
 *   theme-aware logo, navigation buttons for Chat and Transcripts, and
 *   authentication controls. When a user is authenticated it shows a profile
 *   avatar which opens a compact menu providing a theme toggle, links to the
 *   API key and Usage pages, and a logout action.
 *
 * Imports to:
 *   - Used by page modules that render the app shell (chat, transcripts, usage).
 *
 * Exports:
 *   - HeaderBar: named React component export.
 *
 * Exports used by:
 *   - src/app/chat/page.tsx
 *   - src/app/transcripts/page.tsx
 *   - src/app/usage/page.tsx
 *
 * Nuances:
 *   - This file is a client component ("use client") and depends on browser-only
 *     hooks (useSession, useTheme) and DOM event listeners. Keep it as a client component.
 *   - The profile/menu auto-closes after ~5s and also closes when clicking outside.
 *   - The theme toggle expects "dark" / "light" values from the theme provider.
 *   - Avoid placing non-trivial business logic here; this module is composition/UI glue.
 */
"use client";

import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "~/lib/theme-provider";
import ChatIcon from "~/components/icons/Chat";
import TranscriptsIcon from "~/components/icons/Transcripts";

interface HeaderBarProps {
  className?: string;
  activeView: "chat" | "transcripts" | "usage";
  onNav: (view: "chat" | "transcripts") => void;
}

/**
 * HeaderBar
 *
 * Renders the application header with:
 *  - Theme-aware logo
 *  - Navigation buttons for Chat and Transcripts
 *  - Authentication actions (Login) or profile avatar/menu when signed in
 *  - Profile menu actions: theme toggle, Add API Key, Usage, Logout
 *
 * Props:
 *  - activeView: the currently active top-level view ("chat" | "transcripts" | "usage")
 *  - onNav: callback invoked when navigation buttons are clicked (accepts "chat" | "transcripts")
 *
 * Notes:
 *  - Keep this component focused on UI composition; move complex logic to hooks.
 */
export function HeaderBar({ activeView, onNav }: HeaderBarProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!menuOpen) return;

    const timer = setTimeout(() => {
      setMenuOpen(false);
    }, 5000);

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const userImage = session?.user?.image ?? "/img/profile.png";

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
      style={{ backgroundColor: "rgb(var(--header-footer-bg))" }}
    >
      <div className="flex items-center gap-2">
        <button onClick={() => onNav("chat")} className="focus:outline-none">
          <Image
            src={
              theme === "dark"
                ? "/img/voicelibre4-dark.svg"
                : "/img/voicelibre4.svg"
            }
            alt="VoiceLibre Logo"
            fill={false}
            width={0}
            height={0}
            className="h-7 w-auto object-contain"
          />
        </button>
      </div>
      <div className="relative flex items-center gap-4">
        <button onClick={() => onNav("chat")}>
          <ChatIcon
            className={`h-7 w-7 ${
              activeView === "chat"
                ? theme === "dark"
                  ? "text-white"
                  : "text-black"
                : theme === "dark"
                  ? "text-cyan-200"
                  : "text-cyan-600"
            }`}
          />
        </button>
        <button onClick={() => onNav("transcripts")}>
          <TranscriptsIcon
            className={`h-7 w-7 ${
              activeView === "transcripts"
                ? theme === "dark"
                  ? "text-white"
                  : "text-black"
                : theme === "dark"
                  ? "text-cyan-200"
                  : "text-cyan-600"
            }`}
          />
        </button>
        {!session ? (
          <button
            onClick={() => void signIn()}
            className="rounded-full border-2 border-cyan-700 bg-transparent px-2 py-1 text-sm font-semibold text-cyan-600 transition"
          >
            Login
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="focus:outline-none"
            >
              <Image
                src={userImage}
                alt="Profile"
                width={32}
                height={32}
                className="relative top-[2px] h-8 w-8 rounded-full object-cover"
              />
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 z-[500] mt-2 w-48 rounded shadow-lg"
                style={{
                  backgroundColor:
                    theme === "dark"
                      ? "rgba(104, 101, 101, 0.90)"
                      : "rgb(var(--background))",
                  boxShadow:
                    theme === "dark"
                      ? "0 4px 12px rgba(255, 255, 255, 0.1)"
                      : "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div className="flex items-center justify-center px-4 py-2">
                  <button
                    onClick={() =>
                      setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className="flex w-full items-center justify-center gap-2"
                  >
                    <span className="text-sm">Mode</span>
                    <div
                      className="relative h-5 w-10 rounded-full transition-colors duration-300"
                      style={{
                        backgroundColor:
                          theme === "dark" ? "rgb(var(--primary))" : "#FACC15",
                      }}
                    >
                      <div
                        className="absolute top-[2px] h-4 w-4 transform rounded-full bg-white transition-transform duration-200"
                        style={{ left: theme === "dark" ? "22px" : "2px" }}
                      />
                    </div>
                  </button>
                </div>
                <a
                  href="/apikey"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-center hover:bg-gray-100"
                >
                  Add API Key
                </a>
                <a
                  href="/usage"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-center hover:bg-gray-100"
                >
                  Usage
                </a>
                <a
                  href="/help"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-center hover:bg-gray-100"
                >
                  Help
                </a>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="block w-full px-4 py-2 text-center hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
