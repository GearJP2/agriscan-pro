export interface BrowserLlmFallbackEnv {
  DEV: boolean;
  VITE_ENABLE_BROWSER_LLM_FALLBACK?: string;
}

export function isBrowserLlmFallbackEnabled(env: BrowserLlmFallbackEnv): boolean {
  return env.DEV && env.VITE_ENABLE_BROWSER_LLM_FALLBACK === "true";
}
