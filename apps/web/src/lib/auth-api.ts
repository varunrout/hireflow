import { apiClient } from "@/lib/api-client";
import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UpdateUserRequest,
  User,
} from "@hireflow/schemas";

export const authApi = {
  register: async (data: RegisterRequest): Promise<User> => {
    const res = await apiClient.post<User>("/auth/register", data);
    return res.data;
  },

  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>("/auth/login", data);
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<User>("/auth/me");
    return res.data;
  },

  updateMe: async (data: UpdateUserRequest): Promise<User> => {
    const res = await apiClient.put<User>("/auth/me", data);
    return res.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post("/auth/change-password", data);
  },
};
