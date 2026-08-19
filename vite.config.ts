/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

// Imported straight from the Hungarian strings, with an extension, because
// Vite's native config loader resolves no directory indexes and no bare
// specifiers in the config's own module graph.
import { hu } from "./src/strings/hu.ts";

/**
 * The browser tab is a visible string too, so it comes from the strings module
 * rather than being spelled out in index.html. It is injected at build time, so
 * the tab never shows a placeholder first — which also means it is always the
 * Hungarian title. `src/ui/language` moves it from there once the app has read
 * the language the player left the interface in.
 */
const appTitle = (): Plugin => ({
  name: "malom:app-title",
  transformIndexHtml: (html) => html.replace("%APP_TITLE%", hu.app.title),
});

export default defineConfig({
  // The site is served from https://secsaba.github.io/malom/, not from a domain root.
  base: "/malom/",
  plugins: [react(), appTitle()],
  test: {
    // The fast suite. The browser suite is Playwright, under tests/e2e.
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
