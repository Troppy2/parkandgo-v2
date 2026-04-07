import { describe, it, expect } from "vitest";
import { formatEta } from "../formatEta";

describe("formatEta", () => {
  // ── < 60 min ────────────────────────────────────────────────────────────────

  it("shows minutes only for short trips", () => {
    const result = formatEta(45);
    expect(result.primary).toBe("45");
    expect(result.secondary).toBe("min");
  });

  it("shows 1 min for minimum value", () => {
    const result = formatEta(1);
    expect(result.primary).toBe("1");
    expect(result.secondary).toBe("min");
  });

  it("shows 59 min correctly (boundary below 60)", () => {
    const result = formatEta(59);
    expect(result.primary).toBe("59");
    expect(result.secondary).toBe("min");
  });

  // ── exactly 60 min ──────────────────────────────────────────────────────────

  it("converts 60 min to 1 hr with no minute suffix", () => {
    const result = formatEta(60);
    expect(result.primary).toBe("1 hr");
    expect(result.secondary).toBeNull();
  });

  // ── ≥ 60 min with leftover minutes ──────────────────────────────────────────

  it("converts 75 min → 1 hr 15 min", () => {
    const result = formatEta(75);
    expect(result.primary).toBe("1 hr");
    expect(result.secondary).toBe("15 min");
  });

  it("converts 120 min → 2 hr (no minute suffix)", () => {
    const result = formatEta(120);
    expect(result.primary).toBe("2 hr");
    expect(result.secondary).toBeNull();
  });

  it("converts 250 min → 4 hr 10 min", () => {
    const result = formatEta(250);
    expect(result.primary).toBe("4 hr");
    expect(result.secondary).toBe("10 min");
  });

  it("converts 180 min → 3 hr (exact, no minutes)", () => {
    const result = formatEta(180);
    expect(result.primary).toBe("3 hr");
    expect(result.secondary).toBeNull();
  });

  // ── rounding ────────────────────────────────────────────────────────────────

  it("rounds 44.6 min to 45 min", () => {
    const result = formatEta(44.6);
    expect(result.primary).toBe("45");
    expect(result.secondary).toBe("min");
  });

  it("rounds 74.5 min to 75 → 1 hr 15 min", () => {
    const result = formatEta(74.5);
    expect(result.primary).toBe("1 hr");
    expect(result.secondary).toBe("15 min");
  });

  it("rounds 59.5 min to 60 → 1 hr", () => {
    const result = formatEta(59.5);
    expect(result.primary).toBe("1 hr");
    expect(result.secondary).toBeNull();
  });
});
