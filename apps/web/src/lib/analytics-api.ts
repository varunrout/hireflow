import { apiClient } from "@/lib/api-client";

export type DashboardAnalytics = {
  total_applications: number;
  by_status: Record<string, number>;
  conversion_rate: {
    applied_to_screening: number;
    screening_to_offer: number;
    offer_to_accepted: number;
  };
};

export const analyticsApi = {
  getDashboard: async () => {
    const res = await apiClient.get<DashboardAnalytics>("/analytics/dashboard");
    return res.data;
  },
};
