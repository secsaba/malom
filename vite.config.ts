/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The site is served from https://secsaba.github.io/malom/, not from a domain root.
  base: "/malom/",
  plugins: [react()],
  test: {
    // The fast suite. The browser suite is Playwright, under tests/e2e.
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
