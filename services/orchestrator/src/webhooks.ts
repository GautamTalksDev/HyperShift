/** Fire-and-forget webhook POST. No retries; one attempt. */
export async function fireWebhook(
  url: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HyperShift-Event": event,
      },
      body: JSON.stringify({ event, payload, ts: new Date().toISOString() }),
    });
  } catch {
    // ignore
  }
}

export function getWebhookUrl(): string | null {
  return process.env.WEBHOOK_URL || process.env.HYPERSHIFT_WEBHOOK_URL || null;
}
