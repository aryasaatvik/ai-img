import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { fal } from "@ai-sdk/fal";
import type { ImageModel } from "ai";

export type ProviderName = "openai" | "google" | "fal";

export interface ProviderConfig {
  name: ProviderName;
  model: string;
}

interface ProviderMetadata {
  envVars: readonly string[];
  defaultModel: string;
}

const PROVIDER_METADATA: Record<ProviderName, ProviderMetadata> = {
  openai: {
    envVars: ["OPENAI_API_KEY"],
    defaultModel: "gpt-image-1.5",
  },
  google: {
    envVars: [
      "GOOGLE_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
    ],
    defaultModel: "gemini-3-pro-image-preview",
  },
  fal: {
    envVars: ["FAL_API_KEY"],
    defaultModel: "fal-ai/flux/dev",
  },
};

const PROVIDER_PRIORITY: readonly ProviderName[] = ["openai", "google", "fal"];

const PROVIDER_FACTORIES = {
  openai,
  google,
  fal,
} as const;

export interface ProviderDetection {
  provider: ProviderName;
  detected: boolean;
  matchedEnvVar?: string;
}

export interface ProviderSelection {
  provider: ProviderName;
  detections: ProviderDetection[];
  reason: string;
}

function getConfiguredProviders(): ProviderName[] {
  return Object.keys(PROVIDER_METADATA) as ProviderName[];
}

function getApiKeyMatch(provider: ProviderName): {
  key?: string;
  envVar?: string;
} {
  const envVars = PROVIDER_METADATA[provider].envVars;
  for (const envVar of envVars) {
    const key = process.env[envVar];
    if (typeof key === "string" && key.length > 0) {
      return { key, envVar };
    }
  }
  return {};
}

export function getProvider(name: ProviderName) {
  return PROVIDER_FACTORIES[name];
}

export function getDefaultModel(provider: ProviderName): string {
  return PROVIDER_METADATA[provider].defaultModel;
}

export function resolveModel(provider: ProviderName, model?: string): string {
  return model || getDefaultModel(provider);
}

export function getModel(provider: ProviderName, model?: string): ImageModel {
  const providerSdk = getProvider(provider);
  const modelId = resolveModel(provider, model);
  return providerSdk.image(modelId) as ImageModel;
}

export function getApiKey(provider: ProviderName): string | undefined {
  return getApiKeyMatch(provider).key;
}

export function requireApiKey(provider: ProviderName): void {
  const key = getApiKey(provider);
  if (!key) {
    throw new Error(
      `Missing API key for ${provider}. Set ${getEnvVarName(provider)} environment variable.`
    );
  }
}

function getEnvVarName(provider: ProviderName): string {
  return PROVIDER_METADATA[provider].envVars.join(", ");
}

export function validateProvider(name: string): ProviderName {
  if (!getConfiguredProviders().includes(name as ProviderName)) {
    const valid = getConfiguredProviders().join(", ");
    throw new Error(`Invalid provider: ${name}. Valid: ${valid}`);
  }
  return name as ProviderName;
}

export function detectProviderEnv(): ProviderDetection[] {
  return PROVIDER_PRIORITY.map((provider) => {
    const match = getApiKeyMatch(provider);
    return {
      provider,
      detected: Boolean(match.key),
      matchedEnvVar: match.envVar,
    };
  });
}

export function formatDetectedProviders(detections: ProviderDetection[]): string {
  const detected = detections
    .filter((detection) => detection.detected)
    .map((detection) =>
      detection.matchedEnvVar
        ? `${detection.provider} (${detection.matchedEnvVar})`
        : detection.provider
    );

  if (detected.length === 0) {
    return "none";
  }

  return detected.join(", ");
}

export function resolveProviderSelection(requestedProvider?: string): ProviderSelection {
  const detections = detectProviderEnv();

  if (requestedProvider) {
    const provider = validateProvider(requestedProvider);
    return {
      provider,
      detections,
      reason: "explicit --provider",
    };
  }

  const detected = detections.filter((entry) => entry.detected);
  if (detected.length === 0) {
    const allEnvVars = getConfiguredProviders()
      .map((provider) => PROVIDER_METADATA[provider].envVars.join(", "))
      .join("; ");
    throw new Error(
      `No provider detected in environment. Set one of: ${allEnvVars}, or pass --provider with a configured API key.`
    );
  }

  if (detected.length === 1) {
    const selected = detected[0];
    const matchedBy = selected.matchedEnvVar ? ` from ${selected.matchedEnvVar}` : "";
    return {
      provider: selected.provider,
      detections,
      reason: `auto-detected${matchedBy}`,
    };
  }

  const selected = detected[0];
  return {
    provider: selected.provider,
    detections,
    reason: `auto-selected by priority (${PROVIDER_PRIORITY.join(" > ")})`,
  };
}
