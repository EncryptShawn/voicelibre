//src/components/bottomBar/modals/memoryStatusModal
//
// Just let users know when we are clearing memory or re-remembering memories.

import { useEffect } from "react";
import { useTheme } from "~/lib/theme-provider";

type MemoryStatusModalProps = {
  status: "clearing" | "remembering" | null;
  progress?: number;
  total?: number;
  onClose: () => void;
};

export function MemoryStatusModal({
  status,
  progress = 0,
  total = 1,
  onClose,
}: MemoryStatusModalProps) {
  const { theme } = useTheme();
  useEffect(() => {
    if (!status || progress === total) {
      const timer = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(timer);
    }
  }, [status, progress, total, onClose]);

  const operationText =
    status === "clearing"
      ? "Clearing memories..."
      : "Re-remembering memories...";

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        className="rounded-lg p-6 shadow-lg"
        style={{
          backgroundColor:
            theme === "dark" ? "rgb(var(--header-footer-bg))" : "white",
          color: theme === "dark" ? "rgb(var(--foreground))" : "black",
          minWidth: "300px",
        }}
      >
        <div className="mb-4 text-center text-lg font-medium">
          {operationText}
        </div>

        {total > 1 ? (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-sm">
              <span>Progress:</span>
              <span>
                {progress}/{total}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${Math.round((progress / total) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-green-500" />
          </div>
        )}
      </div>
    </div>
  );
}
