import { apiClient } from "@/lib/api-client";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
} from "@hireflow/schemas";

export const authApi = {
  register: async (data: RegisterRequest): Promise<User> => {
    const res = await apiClient.post<User>("/auth/register", data);
    return res.data;
  },

  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>("/auth/login", data);
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
    }
    return res.data;
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<User>("/auth/me");
    return res.data;
  },
};
