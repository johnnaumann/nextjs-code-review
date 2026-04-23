import { z } from "zod";

export const reviewFindingSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().optional(),
  severity: z.enum(["info", "warning", "error"]),
  skill: z.string(),
  ruleId: z.string().optional(),
  message: z.string(),
  suggestion: z.string().optional()
});

export const reviewResultSchema = z.object({
  summary: z.string(),
  findings: z.array(reviewFindingSchema)
});

export type ReviewResultSchema = z.infer<typeof reviewResultSchema>;

