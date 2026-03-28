import { apiClient } from "@/lib/api-client";
import type { ResumeVersion } from "@hireflow/schemas";

export type Persona = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_roles: string[];
  color: string | null;
  is_default: boolean;
  resume_count: number;
  created_at: string;
  updated_at: string;
};

export type CreatePersonaPayload = {
  name: string;
  description?: string | null;
  target_roles?: string[];
  color?: string | null;
  is_default?: boolean;
};

export type UpdatePersonaPayload = Partial<CreatePersonaPayload>;

export type PersonaResume = ResumeVersion & {
  persona_id: string | null;
};

export const personasApi = {
  list: async (): Promise<Persona[]> => {
    const res = await apiClient.get<Persona[]>("/personas");
    return res.data;
  },

  create: async (payload: CreatePersonaPayload): Promise<Persona> => {
    const res = await apiClient.post<Persona>("/personas", payload);
    return res.data;
  },

  update: async (id: string, payload: UpdatePersonaPayload): Promise<Persona> => {
    const res = await apiClient.put<Persona>(`/personas/${id}`, payload);
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/personas/${id}`);
  },

  setDefault: async (id: string): Promise<Persona> => {
    const res = await apiClient.put<Persona>(`/personas/${id}`, { is_default: true });
    return res.data;
  },

  getResumes: async (id: string): Promise<PersonaResume[]> => {
    const res = await apiClient.get<PersonaResume[]>(`/personas/${id}/resumes`);
    return res.data;
  },
};
