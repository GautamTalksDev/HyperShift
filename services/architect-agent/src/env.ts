import { z } from "zod";

const envSchema = z.object({
  ARCHITECT_AGENT_PORT: z.coerce.number().int().min(1).default(4002),
  HOST: z.string().default("0.0.0.0"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "[architect-agent] Invalid env:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}
export const env = parsed.data;
