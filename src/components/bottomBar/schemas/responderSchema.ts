//src/components/bottomBar/schemas/responderSchema.ts
//
//Some input validation for the responder module

import { z } from "zod";

export const responderSchema = z.object({
  model: z.string().min(1, "AI Model is required"),
  voice_model: z.string().nullable(),
  voice: z.string().nullable(),
  max_tokens: z.number().min(100).max(2000),
  prompt: z
    .string()
    .min(10, "Prompt must be at least 10 characters")
    .max(5000, "Prompt must be less than 5000 characters")
    .refine((val) => !val.includes("DROP TABLE"), {
      message: "Invalid prompt content",
    }),
  short_mem: z.number().min(0).max(10),
  long_mem: z.number().min(0).max(10),
  mem_expire: z.number().min(30).max(1440),
});
