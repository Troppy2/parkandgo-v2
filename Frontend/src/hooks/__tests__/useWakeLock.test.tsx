import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useWakeLock } from "../useWakeLock"

type MockSentinel = {
  released: boolean
  release: ReturnType<typeof vi.fn>
}

function makeSentinel(): MockSentinel {
  const sentinel: MockSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true
    }),
  }
  return sentinel
}

function HookHarness({ enabled }: { enabled: boolean }) {
  useWakeLock(enabled)
  return null
}

describe("useWakeLock", () => {
  let sentinel: MockSentinel
  let request: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sentinel = makeSentinel()
    request = vi.fn(async () => sentinel)
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
      writable: true,
    })
    // jsdom reports visibilityState as "visible" by default; make it writable
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("requests a screen wake lock when enabled", async () => {
    render(<HookHarness enabled={true} />)
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"))
  })

  it("does not request a lock when disabled", () => {
    render(<HookHarness enabled={false} />)
    expect(request).not.toHaveBeenCalled()
  })

  it("releases the wake lock on cleanup", async () => {
    const { unmount } = render(<HookHarness enabled={true} />)
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    unmount()
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled())
  })

  it("re-acquires the lock when the page becomes visible again", async () => {
    render(<HookHarness enabled={true} />)
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    // Simulate the browser auto-releasing the lock while backgrounded.
    sentinel.released = true
    document.dispatchEvent(new Event("visibilitychange"))

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  })

  it("does nothing and does not throw when the API is unsupported", () => {
    // Remove the API entirely so "wakeLock" in navigator is false.
    delete (navigator as { wakeLock?: unknown }).wakeLock
    expect("wakeLock" in navigator).toBe(false)
    expect(() => render(<HookHarness enabled={true} />)).not.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
