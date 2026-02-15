import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_ORCHESTRATOR_URL: z
    .string()
    .url()
    .default("http://localhost:4001"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_ORCHESTRATOR_URL: process.env.NEXT_PUBLIC_ORCHESTRATOR_URL,
});
if (!parsed.success) {
  console.error("[dashboard] Invalid env:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
