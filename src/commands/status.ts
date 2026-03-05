import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import {
  describeKeySource,
  detectProviderEnv,
  getDefaultModel,
  resolveModel,
  resolveProviderSelection,
  validateProvider,
} from "../lib/provider";
import { loadAiImgConfig, resolveRuntimeConfig } from "../lib/config";
import { getPreviewCapability, resolvePreviewOptions } from "../lib/preview";
import { imageModeOption } from "./shared/preview-options";

export const statusCommand = defineCommand({
  name: "status",
  description: "Show detected providers and default model resolution",
  options: {
    provider: option(z.string().optional(), {
      short: "P",
      description: "Provider to inspect (openai, google, fal)",
    }),
    "image-mode": imageModeOption,
  },
  handler: async ({ flags, cwd }) => {
    try {
      const loadedConfig = await loadAiImgConfig({ cwd });
      const runtimeConfig = resolveRuntimeConfig(loadedConfig.config);
      const previewOptions = resolvePreviewOptions(runtimeConfig, flags);
      const previewCapability = getPreviewCapability();
      const detections = detectProviderEnv(runtimeConfig.secrets);

      console.log("Provider environment:");
      for (const detection of detections) {
        const envState = detection.detected
          ? `configured via ${detection.matchedSource}`
          : "not detected";
        console.log(
          `- ${detection.provider}: ${envState}; default model: ${getDefaultModel(detection.provider)}`
        );
      }

      console.log("\nConfig sources:");
      for (const source of loadedConfig.sources) {
        console.log(`- ${source.path}: ${source.loaded ? "loaded" : "not found"}`);
      }

      const previewState = previewCapability.supported
        ? `${previewCapability.protocol} supported`
        : `unsupported (${previewCapability.reason ?? "unknown"})`;
      console.log("\nPreview:");
      console.log(`- mode: ${previewOptions.mode}`);
      console.log(`- protocol: ${previewOptions.protocol}`);
      console.log(`- width: ${previewOptions.width ?? "default"}`);
      console.log(`- capability: ${previewState}`);

      if (flags.provider) {
        const provider = validateProvider(flags.provider);
        const matched = detections.find((detection) => detection.provider === provider);
        const state = matched?.detected
          ? `configured (${matched.matchedSource})`
          : "not configured";
        console.log(`\nSelection: ${provider} (explicit --provider, ${state})`);
        console.log(
          `Resolved default model: ${resolveModel(provider, runtimeConfig.defaults.model)}`
        );
        const keySource = describeKeySource(provider, runtimeConfig.secrets);
        console.log(`Key source: ${keySource}`);
        return;
      }

      const hasDetectedProvider = detections.some((detection) => detection.detected);
      if (!hasDetectedProvider) {
        console.log("\nSelection: none (no provider API keys detected)");
        return;
      }

      const selection = resolveProviderSelection(runtimeConfig.defaults.provider, runtimeConfig.secrets);
      console.log(`\nSelection: ${selection.provider} (${selection.reason})`);
      console.log(
        `Resolved default model: ${resolveModel(selection.provider, runtimeConfig.defaults.model)}`
      );
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});

export default statusCommand;
