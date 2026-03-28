"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileApi, type ParsedResumeImport } from "@/lib/profile-api";

interface ImportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportPdfModal({ isOpen, onClose }: ImportPdfModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "overwrite">("merge");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ParsedResumeImport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: "merge" | "overwrite" }) =>
      profileApi.importPdf(file, mode),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["completeness"] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
            "Failed to import PDF.")
          : "Failed to import PDF.";
      setError(msg);
    },
  });

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setResult(null);
    mutation.mutate({ file, mode });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleClose() {
    setResult(null);
    setError(null);
    mutation.reset();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import Resume from PDF
          </h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {!result && (
          <>
            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
              {(["merge", "overwrite"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === m
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                  }`}
                >
                  {m === "merge" ? "Merge (safe)" : "Overwrite (replace all)"}
                </button>
              ))}
            </div>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {mode === "merge"
                ? "New data will be added without removing existing entries."
                : "Existing profile sections will be replaced with data from the PDF."}
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
              }`}
            >
              <span className="mb-2 text-4xl">📄</span>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {mutation.isPending ? "Parsing…" : "Drop your PDF here or click to browse"}
              </p>
              <p className="mt-1 text-xs text-gray-400">PDF only · max 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {mutation.isPending && (
              <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Extracting and parsing your resume…
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            )}
          </>
        )}

        {/* Success summary */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span className="text-xl">✓</span>
              <span className="font-medium">Import complete</span>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
              <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">Added:</p>
              {Object.entries(result.summary.added).length === 0 ? (
                <p className="text-gray-400">Nothing new to add.</p>
              ) : (
                <ul className="space-y-1">
                  {Object.entries(result.summary.added).map(([k, v]) => (
                    <li key={k} className="text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{v}</span>{" "}
                      {k.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              )}

              {Object.entries(result.summary.skipped).length > 0 && (
                <>
                  <p className="mb-2 mt-3 font-medium text-gray-500 dark:text-gray-400">
                    Skipped (already exist):
                  </p>
                  <ul className="space-y-1">
                    {Object.entries(result.summary.skipped).map(([k, v]) => (
                      <li key={k} className="text-gray-400">
                        {v} {k.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Done
              </button>
              <button
                onClick={() => { setResult(null); mutation.reset(); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
              >
                Import another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
