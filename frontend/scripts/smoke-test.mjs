import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import react from "@vitejs/plugin-react-swc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const server = await createServer({
  root: rootDir,
  configFile: false,
  logLevel: "error",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});

const storage = new Map();
const localStorageStub = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, String(value));
  },
  removeItem: (key) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageStub,
});

const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].startsWith("Warning: useLayoutEffect does nothing on the server")
  ) {
    return;
  }

  originalConsoleError(...args);
};

const wrapInRouter = (element, route = "/") =>
  React.createElement(MemoryRouter, { initialEntries: [route] }, element);

try {
  const homepageModule = await server.ssrLoadModule("/src/pages/Homepage.tsx");
  const Homepage = homepageModule.default;
  const homepageMarkup = renderToString(
    wrapInRouter(React.createElement(Homepage), "/"),
  );
  assert.match(homepageMarkup, /safe\?/i);

  const notFoundModule = await server.ssrLoadModule("/src/pages/NotFound.tsx");
  const NotFound = notFoundModule.default;
  const notFoundMarkup = renderToString(
    wrapInRouter(React.createElement(NotFound), "/missing"),
  );
  assert.ok(notFoundMarkup.length > 0);

  const sampleTableModule = await server.ssrLoadModule(
    "/src/features/samples/components/SampleTable.tsx",
  );
  const watchlistModule = await server.ssrLoadModule(
    "/src/contexts/WatchlistContext.tsx",
  );
  const SampleTable = sampleTableModule.default;
  const { WatchlistProvider } = watchlistModule;
  const sampleTableMarkup = renderToString(
    React.createElement(
      WatchlistProvider,
      null,
      React.createElement(SampleTable, {
        samples: [
          {
            sample_id: "SMK-001",
            region: "Central",
            province: "Bangkok",
            district: "Dusit",
            vegetation_variety: "Rice",
            collection_date: "2026-04-24",
            status: "completed",
            mycotoxin_results: [
              {
                name: "AFB1",
                intensity: 8,
                dangerous: false,
                threshold: 5,
                unit: "ppb",
              },
            ],
            process_logs: [
              {
                id: "log-001",
                timestamp: "2026-04-24T10:00:00Z",
                state: "completed",
                conducted_by: "Smoke Test",
              },
            ],
          },
        ],
        onSelectSample: () => {},
      }),
    ),
  );
  assert.match(sampleTableMarkup, /SMK-001/);

  const appModule = await server.ssrLoadModule("/src/App.tsx");
  const { AppRoutes, RouteLoadingFallback } = appModule;
  const routeMarkup = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/prediction"] },
      React.createElement(
        React.Suspense,
        { fallback: React.createElement(RouteLoadingFallback) },
        React.createElement(AppRoutes),
      ),
    ),
  );
  assert.ok(routeMarkup.length > 0);

  console.log("Frontend smoke checks passed");
} finally {
  console.error = originalConsoleError;
  await server.close();
}
