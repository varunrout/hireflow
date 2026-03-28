"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Persona } from "@/lib/personas-api";
import { resumesApi } from "@/lib/resumes-api";

interface ImportResumePdfModalProps {
  isOpen: boolean;
  personas: Persona[];
  onClose: () => void;
  /** Called with the new resume id so the editor can open immediately */
  onImported: (resumeId: string) => void;
}

export function ImportResumePdfModal({
  isOpen,
  personas,
  onClose,
  onImported,
}: ImportResumePdfModalProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [dragging, setDragging] = useState(false);

  const importMutation = useMutation({
    mutationFn: () =>
      resumesApi.importPdf(
        file!,
        name.trim() || (file?.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ") ?? "Imported Resume"),
        personaId || null,
      ),
    onSuccess: (imported) => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      onImported(imported.id!);
      handleClose();
    },
  });

  function handleClose() {
    setFile(null);
    setName("");
    setPersonaId("");
    setDragging(false);
    onClose();
  }

  function acceptFile(f: File) {
    setFile(f);
    if (!name.trim()) {
      setName(f.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " "));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type === "application/pdf" || dropped.name.toLowerCase().endsWith(".pdf"))) {
      acceptFile(dropped);
    }
  }

  const errorDetail =
    (importMutation.error as { response?: { data?: { detail?: string } } } | null)?.response?.data
      ?.detail ?? "Import failed. Make sure the PDF contains extractable text.";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Import PDF Resume</h2>
            <p className="text-xs text-muted-foreground">
              AI parses your PDF into fully editable sections
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                : file
                  ? "border-green-400 bg-green-50 dark:border-green-400 dark:bg-green-900/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) acceptFile(f);
              }}
            />
            {file ? (
              <div>
                <p className="text-2xl">📄</p>
                <p className="mt-1 text-sm font-medium text-green-700 dark:text-green-400">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {(file.size / 1024).toFixed(0)} KB — click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-4xl">📄</p>
                <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drop PDF here or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-400">PDF files only, up to 10 MB</p>
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="import-resume-name">Resume name</Label>
            <Input
              id="import-resume-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Data Scientist Resume 2026"
              className="mt-1"
            />
          </div>

          {/* Persona assignment */}
          {personas.length > 0 && (
            <div>
              <Label htmlFor="import-resume-persona">Assign to persona</Label>
              <select
                id="import-resume-persona"
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No persona</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status / progress */}
          {importMutation.isPending && (
            <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span>Extracting text and running AI parser… this may take 15–30 seconds.</span>
            </div>
          )}

          {importMutation.isError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {errorDetail}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={importMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => importMutation.mutate()}
              disabled={!file || importMutation.isPending}
            >
              {importMutation.isPending ? "Parsing…" : "Import & Parse PDF"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
