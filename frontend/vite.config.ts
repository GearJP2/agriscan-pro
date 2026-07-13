import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { cloudflare } from "@cloudflare/vite-plugin";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const deployTarget = process.env.DEPLOY_TARGET;
  const isTest = mode === "test" || process.env.VITEST === "true";
  const useCloudflare = deployTarget !== "aws" && !isTest;

  return {
    server: {
      host: "::",
      port: Number(process.env.PORT) || 5173,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      useCloudflare && cloudflare(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    cacheDir: "/tmp/agriscan-vite-cache",
    optimizeDeps: {
      force: true,
    },
  };
});
