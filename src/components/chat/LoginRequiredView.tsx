// src/components/chat/LoginRequiredView.tsx
//We send users here when they arent logged in, displays login button on the main screen.

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "~/lib/theme-provider";
import { useEffect, useState } from "react";

type LoginRequiredViewProps = Record<string, never>;

export function LoginRequiredView({}: LoginRequiredViewProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <Image
          src={
            theme === "light"
              ? "/img/voicelibre4.svg"
              : "/img/voicelibre4-dark.svg"
          }
          alt="VoiceLibre Logo"
          width={0}
          height={0}
          className="h-7 w-auto object-contain"
        />
      </div>
      <div className="text-center text-lg font-medium dark:text-white">
        Please login to continue
      </div>
      <button
        onClick={() =>
          router.push(
            `/api/auth/signin?callbackUrl=${encodeURIComponent(`${window.location.origin}/`)}`,
          )
        }
        className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-white hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700"
      >
        Login
      </button>
    </div>
  );
}
