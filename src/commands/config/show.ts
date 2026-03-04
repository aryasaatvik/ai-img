import { defineCommand } from "@bunli/core";
import { loadAiImgConfig, redactSecrets, resolveRuntimeConfig } from "../../lib/config";
import { detectProviderEnv } from "../../lib/provider";

export const configShowCommand = defineCommand({
  name: "show",
  description: "Show effective merged configuration (secrets redacted)",
  handler: async ({ cwd }) => {
    const loadedConfig = await loadAiImgConfig({ cwd });

    if (!loadedConfig.config) {
      console.log("No config file loaded.");
      console.log("\nSearched sources:");
      for (const source of loadedConfig.sources) {
        console.log(`- ${source.path}: ${source.loaded ? "loaded" : "not found"}`);
      }
      return;
    }

    console.log("Effective config (redacted):");
    console.log(JSON.stringify(redactSecrets(loadedConfig.config), null, 2));

    console.log("\nLoaded sources:");
    for (const source of loadedConfig.sources) {
      console.log(`- ${source.path}: ${source.loaded ? "loaded" : "not found"}`);
    }

    const runtimeConfig = resolveRuntimeConfig(loadedConfig.config);
    const detections = detectProviderEnv(runtimeConfig.secrets);
    console.log("\nSecret resolution:");
    for (const detection of detections) {
      const state = detection.detected
        ? `configured via ${detection.matchedSource}`
        : "not configured";
      console.log(`- ${detection.provider}: ${state}`);
    }
  },
});

export default configShowCommand;
