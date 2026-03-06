import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createFal } from "@ai-sdk/fal";
import type { ImageModel } from "ai";

export type ProviderName = "openai" | "google" | "fal";
export type ProviderSecretMap = Partial<Record<ProviderName, string>>;

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

export interface ProviderDetection {
  provider: ProviderName;
  detected: boolean;
  sourceType?: "env" | "config";
  matchedEnvVar?: string;
  matchedSource?: string;
}

export interface ProviderSelection {
  provider: ProviderName;
  detections: ProviderDetection[];
  reason: string;
}

function getConfiguredProviders(): ProviderName[] {
  return Object.keys(PROVIDER_METADATA) as ProviderName[];
}

function getEnvVarName(provider: ProviderName): string {
  return PROVIDER_METADATA[provider].envVars.join(", ");
}

function getApiKeyHint(provider: ProviderName): string {
  return `${getEnvVarName(provider)} or config.aiImg.secrets.${provider}`;
}

function getApiKeyMatch(
  provider: ProviderName,
  secrets?: ProviderSecretMap
): {
  key?: string;
  sourceType?: "env" | "config";
  envVar?: string;
} {
  const envVars = PROVIDER_METADATA[provider].envVars;
  for (const envVar of envVars) {
    const key = process.env[envVar];
    if (typeof key === "string" && key.length > 0) {
      return { key, sourceType: "env", envVar };
    }
  }

  const configKey = secrets?.[provider];
  if (typeof configKey === "string" && configKey.length > 0) {
    return { key: configKey, sourceType: "config" };
  }

  return {};
}

export function getApiKeySource(
  provider: ProviderName,
  secrets?: ProviderSecretMap
): {
  sourceType?: "env" | "config";
  envVar?: string;
} {
  const match = getApiKeyMatch(provider, secrets);
  return {
    sourceType: match.sourceType,
    envVar: match.envVar,
  };
}

export function describeKeySource(provider: ProviderName, secrets?: ProviderSecretMap): string {
  const source = getApiKeySource(provider, secrets);
  if (source.sourceType === "env") {
    return source.envVar ?? "environment variable";
  }
  if (source.sourceType === "config") {
    return `config.aiImg.secrets.${provider}`;
  }
  return "unconfigured";
}

export function getProvider(name: ProviderName, secrets?: ProviderSecretMap) {
  const apiKey = getApiKey(name, secrets);

  switch (name) {
    case "openai":
      return createOpenAI({ apiKey });
    case "google":
      return createGoogleGenerativeAI({ apiKey });
    case "fal":
      return createFal({ apiKey });
  }
}

export function getDefaultModel(provider: ProviderName): string {
  return PROVIDER_METADATA[provider].defaultModel;
}

export function resolveModel(provider: ProviderName, model?: string): string {
  return model || getDefaultModel(provider);
}

export function getModel(
  provider: ProviderName,
  model?: string,
  secrets?: ProviderSecretMap
): ImageModel {
  const providerSdk = getProvider(provider, secrets);
  const modelId = resolveModel(provider, model);
  return providerSdk.image(modelId) as ImageModel;
}

export function getApiKey(
  provider: ProviderName,
  secrets?: ProviderSecretMap
): string | undefined {
  return getApiKeyMatch(provider, secrets).key;
}

export function requireApiKey(provider: ProviderName, secrets?: ProviderSecretMap): void {
  const key = getApiKey(provider, secrets);
  if (!key) {
    throw new Error(`Missing API key for ${provider}. Configure ${getApiKeyHint(provider)}.`);
  }
}

export function validateProvider(name: string): ProviderName {
  if (!getConfiguredProviders().includes(name as ProviderName)) {
    const valid = getConfiguredProviders().join(", ");
    throw new Error(`Invalid provider: ${name}. Valid: ${valid}`);
  }
  return name as ProviderName;
}

export function detectProviderEnv(secrets?: ProviderSecretMap): ProviderDetection[] {
  return PROVIDER_PRIORITY.map((provider) => {
    const match = getApiKeyMatch(provider, secrets);
    const sourceType = match.sourceType;
    const matchedSource =
      sourceType === "env"
        ? match.envVar
        : sourceType === "config"
          ? `config.aiImg.secrets.${provider}`
          : undefined;

    return {
      provider,
      detected: Boolean(match.key),
      sourceType,
      matchedEnvVar: match.envVar,
      matchedSource,
    };
  });
}

export function formatDetectedProviders(detections: ProviderDetection[]): string {
  const detected = detections
    .filter((detection) => detection.detected)
    .map((detection) =>
      detection.matchedSource ? `${detection.provider} (${detection.matchedSource})` : detection.provider
    );

  if (detected.length === 0) {
    return "none";
  }

  return detected.join(", ");
}

export function resolveProviderSelection(
  requestedProvider?: string,
  secrets?: ProviderSecretMap
): ProviderSelection {
  const detections = detectProviderEnv(secrets);

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
    const allHints = getConfiguredProviders()
      .map((provider) => getApiKeyHint(provider))
      .join("; ");
    throw new Error(
      `No provider detected. Configure one of: ${allHints}, or pass --provider with configured credentials.`
    );
  }

  if (detected.length === 1) {
    const selected = detected[0];
    const matchedBy = selected.matchedSource ? ` from ${selected.matchedSource}` : "";
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

export function resolveProviderConfig(
  requestedProvider: string | undefined,
  requestedModel: string | undefined,
  secrets?: ProviderSecretMap
): ProviderConfig {
  const selection = resolveProviderSelection(requestedProvider, secrets);
  const provider = selection.provider;
  requireApiKey(provider, secrets);
  return {
    name: provider,
    model: resolveModel(provider, requestedModel),
  };
}
