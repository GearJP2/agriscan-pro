import { describe, expect, it } from "vitest";

import { isBrowserLlmFallbackEnabled } from "@/lib/llmFallbackGate";

describe("isBrowserLlmFallbackEnabled", () => {
  it("returns false by default when opt-in is missing", () => {
    expect(
      isBrowserLlmFallbackEnabled({
        DEV: true,
      }),
    ).toBe(false);
  });

  it("returns false when running outside development", () => {
    expect(
      isBrowserLlmFallbackEnabled({
        DEV: false,
        VITE_ENABLE_BROWSER_LLM_FALLBACK: "true",
      }),
    ).toBe(false);
  });

  it("returns true only with explicit opt-in in development", () => {
    expect(
      isBrowserLlmFallbackEnabled({
        DEV: true,
        VITE_ENABLE_BROWSER_LLM_FALLBACK: "true",
      }),
    ).toBe(true);
  });
});
