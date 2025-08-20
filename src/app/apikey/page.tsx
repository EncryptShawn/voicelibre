//src/app/apikey/page.tsx
//
//the page for handling users APIKeys

"use client";

import { useSession } from "next-auth/react";
import { HeaderBar } from "../../components/HeaderBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function APIKeyPage() {
  useSession();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void fetch("/api/apikey")
      .then((res) => res.json())
      .then((data: { hasKey?: boolean }) => {
        if (data?.hasKey) setHasKey(true);
      });
  }, []);

  const saveKey = async () => {
    setLoading(true);
    await fetch("/api/apikey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: apiKey }),
    });
    setHasKey(true);
    setLoading(false);
    setSuccessMessage("API key saved successfully!");
    setTimeout(() => router.push("/"), 2000);
  };

  const deleteKey = async () => {
    setLoading(true);
    await fetch("/api/apikey", { method: "DELETE" });
    setHasKey(false);
    setApiKey("");
    setLoading(false);
    setSuccessMessage("API key deleted successfully!");
    setTimeout(() => router.push("/"), 2000);
  };

  return (
    <>
      <HeaderBar
        activeView="chat"
        onNav={(view) => router.push(view === "chat" ? "/" : "/transcripts")}
        className="border-b border-gray-200 dark:border-gray-700"
      />
      <div className="text-foreground bg-background min-h-screen p-6">
        <div className="mb-6 flex flex-col items-center pt-5">
          <picture>
            <source
              srcSet="/img/apipie-drk.png"
              media="(prefers-color-scheme: dark)"
            />
            <img
              src="/img/apipie-light.png"
              alt="APIpie logo"
              className="w-32"
            />
          </picture>
          <h1 className="mt-2 text-xl font-bold">Powered by APIpie.ai</h1>
          <p className="mt-4 text-center">
            This app integrates with <strong>APIpie</strong> to power AI
            features. For the initial release of <strong>voiceLibre</strong>,
            you must use an API key.
          </p>
          <p className="mt-4 text-center">
            Create an API key for <strong>voiceLibre</strong> at&nbsp;
            <a
              href="https://apipie.ai/profile/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              apipie.ai/profile/api-keys
            </a>
            , then paste it below. You can manage/revoke your key on APIpie at
            any time.
          </p>
        </div>

        <label className="mb-2 block font-medium">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="bg-background text-foreground w-full rounded border p-2"
          placeholder={hasKey ? "••••••••••••" : "Enter your API key"}
        />

        {successMessage && (
          <div className="mb-4 rounded bg-green-100 p-3 text-green-800">
            {successMessage}
          </div>
        )}
        <div className="mt-4 flex gap-4">
          <button
            onClick={saveKey}
            className="bg-primary text-foreground rounded px-4 py-2 disabled:opacity-50"
            disabled={!apiKey || loading}
          >
            Save
          </button>
          {hasKey && (
            <button
              onClick={deleteKey}
              className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
              disabled={loading}
            >
              Delete Key
            </button>
          )}
        </div>
      </div>
    </>
  );
}
