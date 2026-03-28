"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { personasApi, type Persona } from "@/lib/personas-api";

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

const DEFAULT_PRESET_PERSONAS = [
  { name: "Data Scientist", target_roles: ["Data Scientist", "ML Engineer", "Research Scientist"], color: "#8b5cf6" },
  { name: "Data Engineer", target_roles: ["Data Engineer", "Analytics Engineer", "Platform Engineer"], color: "#3b82f6" },
  { name: "Data Analyst", target_roles: ["Data Analyst", "Business Intelligence Analyst", "Analytics Analyst"], color: "#10b981" },
];

function PersonaBadge({ name, color, is_default }: { name: string; color: string | null; is_default: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color ?? "#6b7280" }}
    >
      {is_default && <span className="text-[10px]">★</span>}
      {name}
    </span>
  );
}

function PersonaCard({
  persona,
  onSetDefault,
  onDelete,
  onEdit,
  isDeleting,
  isSettingDefault,
}: {
  persona: Persona;
  onSetDefault: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4 transition-shadow hover:shadow-md dark:border-gray-700"
      style={{ borderLeftColor: persona.color ?? "#6b7280", borderLeftWidth: 4 }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{persona.name}</h3>
            {persona.is_default && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Active
              </span>
            )}
          </div>
          {persona.description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{persona.description}</p>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {persona.resume_count} resume{persona.resume_count !== 1 ? "s" : ""}
        </span>
      </div>

      {persona.target_roles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {persona.target_roles.map((role) => (
            <span
              key={role}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              {role}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {!persona.is_default && (
          <button
            onClick={onSetDefault}
            disabled={isSettingDefault}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 disabled:opacity-50"
          >
            Set active
          </button>
        )}
        <button
          onClick={onEdit}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          {isDeleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

type FormState = {
  name: string;
  description: string;
  target_roles: string;
  color: string;
  is_default: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  target_roles: "",
  color: PRESET_COLORS[0]!,
  is_default: false,
};

export function PersonaSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: personasApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      personasApi.create({
        name: form.name,
        description: form.description || null,
        target_roles: form.target_roles.split(",").map((r) => r.trim()).filter(Boolean),
        color: form.color,
        is_default: form.is_default,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      personasApi.update(id, {
        name: form.name,
        description: form.description || null,
        target_roles: form.target_roles.split(",").map((r) => r.trim()).filter(Boolean),
        color: form.color,
        is_default: form.is_default,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      setEditingId(null);
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: personasApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: personasApi.setDefault,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });

  function startEdit(persona: Persona) {
    setEditingId(persona.id);
    setForm({
      name: persona.name,
      description: persona.description ?? "",
      target_roles: persona.target_roles.join(", "),
      color: persona.color ?? PRESET_COLORS[0]!,
      is_default: persona.is_default,
    });
    setShowForm(true);
  }

  function startCreate(preset?: (typeof DEFAULT_PRESET_PERSONAS)[0]) {
    setEditingId(null);
    setForm(preset
      ? { name: preset.name, description: "", target_roles: preset.target_roles.join(", "), color: preset.color, is_default: false }
      : emptyForm
    );
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Personas</h2>
          <p className="text-sm text-muted-foreground">
            Define the roles you&apos;re applying for. Each persona groups its own tailored resumes.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => startCreate()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add persona
          </button>
        )}
      </div>

      {/* Quick-start presets */}
      {!showForm && personas.length === 0 && !isLoading && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Quick start:</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PRESET_PERSONAS.map((p) => (
              <button
                key={p.name}
                onClick={() => startCreate(p)}
                className="rounded-full border px-3 py-1 text-xs font-medium hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-dashed bg-gray-50 p-4 dark:bg-gray-800/50">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {editingId ? "Edit persona" : "New persona"}
          </h3>
          <div className="space-y-3">
            <input
              placeholder="Name (e.g. Data Scientist)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <input
              placeholder="Target roles (comma-separated)"
              value={form.target_roles}
              onChange={(e) => setForm((f) => ({ ...f, target_roles: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            {/* Color picker */}
            <div>
              <p className="mb-1.5 text-xs text-gray-500">Badge color</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="h-6 w-6 rounded-full ring-offset-1 transition-all"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? `2px solid ${c}` : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                className="rounded"
              />
              Set as active persona
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => (editingId ? updateMutation.mutate(editingId) : createMutation.mutate())}
              disabled={!form.name || isSaving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : editingId ? "Save changes" : "Create"}
            </button>
            <button
              onClick={cancelForm}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
            >
              Cancel
            </button>
            {/* Preview badge */}
            {form.name && (
              <PersonaBadge name={form.name} color={form.color} is_default={form.is_default} />
            )}
          </div>
        </div>
      )}

      {/* Persona list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      )}

      {!isLoading && personas.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No personas yet. Add one to start grouping your resumes by role.
        </div>
      )}

      <div className="space-y-3">
        {personas.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            onSetDefault={() => setDefaultMutation.mutate(persona.id)}
            onDelete={() => deleteMutation.mutate(persona.id)}
            onEdit={() => startEdit(persona)}
            isDeleting={deleteMutation.isPending && deleteMutation.variables === persona.id}
            isSettingDefault={setDefaultMutation.isPending && setDefaultMutation.variables === persona.id}
          />
        ))}
      </div>
    </section>
  );
}
