import { defineConfig } from "@bunli/core";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  name: "ai-img",
  version: pkg.version,
  description: "AI Image Generation CLI",
  commands: {
    directory: "./src/commands",
  },
  build: {
    entry: "./src/index.ts",
    outdir: "./dist",
    targets: [],  // JS bundle mode — requires Bun at runtime
    minify: true,
    sourcemap: true,
  },
  release: {
    npm: true,
    github: true,
    tagFormat: "v{{version}}",
    conventionalCommits: true,
  },
});
