import { z } from "zod";

export const UUIDSchema = z.string().uuid();

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
  });

export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const TimestampsSchema = z.object({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
