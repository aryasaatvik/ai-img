import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { fal } from "@ai-sdk/fal";
import type { ImageModel } from "ai";

export type ProviderName = "openai" | "google" | "fal";

export interface ProviderConfig {
  name: ProviderName;
  model: string;
}

// Default models per provider
const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-image-1.5",
  google: "imagen-3.0-generate-002",
  fal: "fal-ai/flux/dev",
};

export function getProvider(name: ProviderName) {
  switch (name) {
    case "openai":
      return openai;
    case "google":
      return google;
    case "fal":
      return fal;
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export function getModel(provider: ProviderName, model?: string): ImageModel {
  const providerSdk = getProvider(provider);
  const modelId = model || DEFAULT_MODELS[provider];
  return providerSdk.image(modelId) as ImageModel;
}

export function getApiKey(provider: ProviderName): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "google":
      return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "fal":
      return process.env.FAL_API_KEY;
    default:
      return undefined;
  }
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
  switch (provider) {
    case "openai":
      return "OPENAI_API_KEY";
    case "google":
      return "GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY";
    case "fal":
      return "FAL_API_KEY";
    default:
      return "API_KEY";
  }
}

export function validateProvider(name: string): ProviderName {
  if (!["openai", "google", "fal"].includes(name)) {
    throw new Error(`Invalid provider: ${name}. Valid: openai, google, fal`);
  }
  return name as ProviderName;
}
