import { z } from "zod";

export const jobSchemas = {
  "translate-repo": z.object({
    installationId: z.number().int().positive(),
    repoFullName: z.string().min(1),
    sha: z.string().min(1),
    reason: z.enum(["push", "manual", "retry"]),
    enforceLocales: z.array(z.string().min(1)).optional(),
  }),
} as const;

export type JobSchemas = typeof jobSchemas;
export type JobName = keyof JobSchemas;
export type JobPayload<N extends JobName> = z.infer<JobSchemas[N]>;
