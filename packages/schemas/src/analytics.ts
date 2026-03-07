import { z } from "zod";

export const AnalyticsEventSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  event_type: z.string().min(1).max(100),
  entity_type: z.string().max(100).optional().nullable(),
  entity_id: z.string().uuid().optional().nullable(),
  properties: z.record(z.unknown()).default({}),
  occurred_at: z.string().datetime(),
});

export const AuditLogSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional().nullable(),
  action: z.string().min(1).max(200),
  resource_type: z.string().max(100),
  resource_id: z.string().max(200).optional().nullable(),
  changes: z.record(z.unknown()).optional().nullable(),
  ip_address: z.string().max(45).optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
  occurred_at: z.string().datetime(),
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
