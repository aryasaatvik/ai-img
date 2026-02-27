import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import {
  detectProviderEnv,
  getDefaultModel,
  resolveModel,
  resolveProviderSelection,
  validateProvider,
} from "../lib/provider";

export const statusCommand = defineCommand({
  name: "status",
  description: "Show detected providers and default model resolution",
  options: {
    provider: option(z.string().optional(), {
      short: "P",
      description: "Provider to inspect (openai, google, fal)",
    }),
  },
  handler: async ({ flags }) => {
    try {
      const detections = detectProviderEnv();

      console.log("Provider environment:");
      for (const detection of detections) {
        const envState = detection.detected
          ? `detected via ${detection.matchedEnvVar}`
          : "not detected";
        console.log(
          `- ${detection.provider}: ${envState}; default model: ${getDefaultModel(detection.provider)}`
        );
      }

      if (flags.provider) {
        const provider = validateProvider(flags.provider);
        const matched = detections.find((detection) => detection.provider === provider);
        const state = matched?.detected
          ? `configured (${matched.matchedEnvVar})`
          : "not configured";
        console.log(`\nSelection: ${provider} (explicit --provider, ${state})`);
        console.log(`Resolved default model: ${resolveModel(provider)}`);
        return;
      }

      const hasDetectedProvider = detections.some((detection) => detection.detected);
      if (!hasDetectedProvider) {
        console.log("\nSelection: none (no provider API keys detected)");
        return;
      }

      const selection = resolveProviderSelection();
      console.log(`\nSelection: ${selection.provider} (${selection.reason})`);
      console.log(`Resolved default model: ${resolveModel(selection.provider)}`);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});
