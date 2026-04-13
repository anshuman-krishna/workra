// simple in-memory counters for basic observability. these reset on restart,
// which is fine for a single-process deployment. if we ever need durable metrics,
// swap this for prometheus-client or similar.

const counters: Record<string, number> = {
  requests_total: 0,
  errors_total: 0,
  ai_calls_total: 0,
  ai_failures_total: 0,
};

export function increment(name: keyof typeof counters, amount = 1): void {
  counters[name] = (counters[name] ?? 0) + amount;
}

export function getMetrics(): Record<string, number> {
  return { ...counters };
}
