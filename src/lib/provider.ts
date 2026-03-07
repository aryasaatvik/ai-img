import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createFal } from "@ai-sdk/fal";
import type { ImageModelV3 } from "@ai-sdk/provider";

export type ProviderName = "openai" | "google" | "fal";
export type ProviderSecretMap = Partial<Record<ProviderName, string>>;
export type ImageSize = `${number}x${number}`;
export type AspectRatio = `${number}:${number}`;

export interface ProviderConfig {
  name: ProviderName;
  model: string;
}

export interface ModelPreset {
  supportsSize: boolean;
  supportsAspectRatio: boolean;
  defaultSize?: ImageSize;
  defaultAspectRatio?: AspectRatio;
  supportedAspectRatios?: readonly AspectRatio[];
}

export interface ImageDimensionResolution {
  size?: ImageSize;
  aspectRatio?: AspectRatio;
  source: "flag" | "config" | "preset" | "none";
  presetMatched: boolean;
}

interface ProviderMetadata {
  envVars: readonly string[];
  defaultModel: string;
  presets?: Readonly<Record<string, ModelPreset>>;
}

const GEMINI_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const satisfies readonly AspectRatio[];

const FAL_COMMON_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "10:16",
  "16:10",
  "9:21",
  "21:9",
] as const satisfies readonly AspectRatio[];

const PROVIDER_METADATA: Record<ProviderName, ProviderMetadata> = {
  openai: {
    envVars: ["OPENAI_API_KEY"],
    defaultModel: "gpt-image-1.5",
    presets: {
      "gpt-image-1.5": {
        supportsSize: true,
        supportsAspectRatio: false,
        defaultSize: "1024x1024",
      },
    },
  },
  google: {
    envVars: [
      "GOOGLE_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
    ],
    defaultModel: "gemini-3-pro-image-preview",
    presets: {
      "gemini-2.5-flash-image": {
        supportsSize: false,
        supportsAspectRatio: true,
        defaultAspectRatio: "1:1",
        supportedAspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
      },
      "gemini-3-pro-image-preview": {
        supportsSize: false,
        supportsAspectRatio: true,
        defaultAspectRatio: "1:1",
        supportedAspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
      },
      "gemini-3.1-flash-image-preview": {
        supportsSize: false,
        supportsAspectRatio: true,
        defaultAspectRatio: "1:1",
        supportedAspectRatios: GEMINI_IMAGE_ASPECT_RATIOS,
      },
    },
  },
  fal: {
    envVars: ["FAL_API_KEY"],
    defaultModel: "fal-ai/flux/dev",
    presets: {
      "fal-ai/flux/dev": {
        supportsSize: true,
        supportsAspectRatio: true,
        defaultSize: "1024x1024",
        supportedAspectRatios: FAL_COMMON_ASPECT_RATIOS,
      },
    },
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

interface ImageDimensionCandidate {
  kind: "size" | "aspectRatio";
  value: string;
  source: Exclude<ImageDimensionResolution["source"], "preset" | "none">;
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

export function getModelPreset(
  provider: ProviderName,
  model: string
): ModelPreset | undefined {
  return PROVIDER_METADATA[provider].presets?.[model];
}

export function resolveModel(provider: ProviderName, model?: string): string {
  return model || getDefaultModel(provider);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function parseImageSize(size: string): [number, number] {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) {
    throw new Error(`Invalid size: ${size}. Expected WIDTHxHEIGHT.`);
  }

  return [Number(match[1]), Number(match[2])];
}

function parseAspectRatio(aspectRatio: string): AspectRatio {
  if (!/^\d+:\d+$/.test(aspectRatio)) {
    throw new Error(`Invalid aspect ratio: ${aspectRatio}. Expected WIDTH:HEIGHT.`);
  }
  return aspectRatio as AspectRatio;
}

function normalizeImageSize(size: string): ImageSize {
  parseImageSize(size);
  return size as ImageSize;
}

function validateAspectRatioForPreset(
  provider: ProviderName,
  model: string,
  preset: ModelPreset,
  aspectRatio: AspectRatio
): void {
  if (
    preset.supportedAspectRatios &&
    !preset.supportedAspectRatios.includes(aspectRatio)
  ) {
    const supported = preset.supportedAspectRatios.join(", ");
    throw new Error(
      `Model ${provider}/${model} does not support aspect ratio ${aspectRatio}. Supported values: ${supported}.`
    );
  }
}

function resolveDimensionCandidate(
  provider: ProviderName,
  model: string,
  preset: ModelPreset | undefined,
  candidate: ImageDimensionCandidate,
  strictUnsupported: boolean
): ImageDimensionResolution | null {
  if (candidate.kind === "size") {
    const size = normalizeImageSize(candidate.value);

    if (!preset) {
      return {
        size,
        source: candidate.source,
        presetMatched: false,
      };
    }

    if (preset.supportsSize) {
      return {
        size,
        source: candidate.source,
        presetMatched: true,
      };
    }

    if (preset.supportsAspectRatio) {
      const aspectRatio = convertSizeToAspectRatio(size);
      validateAspectRatioForPreset(provider, model, preset, aspectRatio);
      return {
        aspectRatio,
        source: candidate.source,
        presetMatched: true,
      };
    }

    if (strictUnsupported) {
      throw new Error(`Model ${provider}/${model} does not support image size overrides.`);
    }

    return null;
  }

  const aspectRatio = parseAspectRatio(candidate.value);

  if (!preset) {
    return {
      aspectRatio,
      source: candidate.source,
      presetMatched: false,
    };
  }

  if (preset.supportsAspectRatio) {
    validateAspectRatioForPreset(provider, model, preset, aspectRatio);
    return {
      aspectRatio,
      source: candidate.source,
      presetMatched: true,
    };
  }

  if (strictUnsupported) {
    throw new Error(`Model ${provider}/${model} does not support aspect ratio. Use --size instead.`);
  }

  return null;
}

function getConfigCandidates(
  preset: ModelPreset | undefined,
  size: string | undefined,
  aspectRatio: string | undefined
): ImageDimensionCandidate[] {
  if (!size && !aspectRatio) {
    return [];
  }

  if (size && aspectRatio) {
    if (preset?.supportsSize) {
      return [{ kind: "size", value: size, source: "config" }];
    }
    if (preset?.supportsAspectRatio) {
      return [{ kind: "aspectRatio", value: aspectRatio, source: "config" }];
    }
    return [{ kind: "size", value: size, source: "config" }];
  }

  return [
    ...(size ? [{ kind: "size", value: size, source: "config" } as const] : []),
    ...(aspectRatio
      ? [{ kind: "aspectRatio", value: aspectRatio, source: "config" } as const]
      : []),
  ];
}

export function convertSizeToAspectRatio(size: string): AspectRatio {
  const [width, height] = parseImageSize(size);
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}` as AspectRatio;
}

export function resolveImageDimensions(options: {
  provider: ProviderName;
  model: string;
  size?: string;
  aspectRatio?: string;
  configSize?: string;
  configAspectRatio?: string;
}): ImageDimensionResolution {
  const preset = getModelPreset(options.provider, options.model);

  if (options.size && options.aspectRatio) {
    throw new Error("Pass either --size or --aspectRatio, not both.");
  }

  if (options.size) {
    return (
      resolveDimensionCandidate(
        options.provider,
        options.model,
        preset,
        { kind: "size", value: options.size, source: "flag" },
        true
      ) ?? {
        source: "none",
        presetMatched: Boolean(preset),
      }
    );
  }

  if (options.aspectRatio) {
    return (
      resolveDimensionCandidate(
        options.provider,
        options.model,
        preset,
        { kind: "aspectRatio", value: options.aspectRatio, source: "flag" },
        true
      ) ?? {
        source: "none",
        presetMatched: Boolean(preset),
      }
    );
  }

  for (const candidate of getConfigCandidates(
    preset,
    options.configSize,
    options.configAspectRatio
  )) {
    const resolved = resolveDimensionCandidate(
      options.provider,
      options.model,
      preset,
      candidate,
      false
    );
    if (resolved) {
      return resolved;
    }
  }

  if (preset?.defaultSize) {
    return {
      size: preset.defaultSize,
      source: "preset",
      presetMatched: true,
    };
  }

  if (preset?.defaultAspectRatio) {
    return {
      aspectRatio: preset.defaultAspectRatio,
      source: "preset",
      presetMatched: true,
    };
  }

  return {
    source: "none",
    presetMatched: false,
  };
}

export function formatImageWarning(warning: unknown): string {
  if (typeof warning === "string") {
    return warning;
  }

  if (typeof warning !== "object" || warning === null) {
    return String(warning);
  }

  const record = warning as Record<string, unknown>;
  if (typeof record.details === "string" && record.details.length > 0) {
    if (typeof record.feature === "string" && record.feature.length > 0) {
      return `${record.feature}: ${record.details}`;
    }
    return record.details;
  }

  if (typeof record.message === "string" && record.message.length > 0) {
    return record.message;
  }

  return JSON.stringify(record);
}

export function getModel(
  provider: ProviderName,
  model?: string,
  secrets?: ProviderSecretMap
): ImageModelV3 {
  const providerSdk = getProvider(provider, secrets);
  const modelId = resolveModel(provider, model);
  return providerSdk.image(modelId) as ImageModelV3;
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
