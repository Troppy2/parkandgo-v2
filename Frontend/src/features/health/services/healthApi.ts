import client from "../../../lib/api/client"

const STARTUP_CHECKS_ENDPOINT = "/health/startup-checks"

export async function checkHealth(): Promise<void> {
  await client.get(STARTUP_CHECKS_ENDPOINT)
}
type startupProbeOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onAttempt?: (attempt: number, delay: number) => void;
}

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_BASE_DELAY_MS = 700
const DEFAULT_MAX_DELAY_MS = 6000

function isAbortError(error: unknown): error is { name: string } {
  return typeof error === "object" && error !== null && "name" in error && (error as { name: string }).name === "AbortError"
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeout)
        reject(new DOMException("Aborted", "AbortError"))
      })
    }
  })
}

export async function checkHealthWithBackoff(options: startupProbeOptions = {}): Promise<void> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    signal,
    onAttempt,
  } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checkHealth()
      return // Success
    } catch (error) {
      if (isAbortError(error)) {
        throw error // Propagate abort signal
      }
      if (attempt === maxAttempts) {
        throw new Error(`Health check failed after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`)
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
      onAttempt?.(attempt, delay)
      await sleep(delay, signal)
    }
  }
}