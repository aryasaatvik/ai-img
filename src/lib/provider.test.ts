import { afterEach, describe, expect, test } from "bun:test";
import {
  describeKeySource,
  detectProviderEnv,
  getApiKey,
  getApiKeySource,
  resolveProviderSelection,
  type ProviderSecretMap,
} from "./provider";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "FAL_API_KEY",
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
}

function resetProviderEnv(): void {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  resetProviderEnv();
});

describe("provider secret precedence", () => {
  test("env API key wins over config secret", () => {
    process.env.OPENAI_API_KEY = "env-openai";
    const secrets: ProviderSecretMap = { openai: "cfg-openai" };

    expect(getApiKey("openai", secrets)).toBe("env-openai");
    expect(getApiKeySource("openai", secrets)).toEqual({
      sourceType: "env",
      envVar: "OPENAI_API_KEY",
    });
    expect(describeKeySource("openai", secrets)).toBe("OPENAI_API_KEY");
  });

  test("config secret is used when env is absent", () => {
    delete process.env.OPENAI_API_KEY;
    const secrets: ProviderSecretMap = { openai: "cfg-openai" };

    expect(getApiKey("openai", secrets)).toBe("cfg-openai");
    expect(getApiKeySource("openai", secrets)).toEqual({
      sourceType: "config",
      envVar: undefined,
    });
    expect(describeKeySource("openai", secrets)).toBe("config.aiImg.secrets.openai");
  });

  test("google env alias precedence uses first configured env var in metadata order", () => {
    process.env.GEMINI_API_KEY = "gemini";
    process.env.GOOGLE_API_KEY = "google";
    const secrets: ProviderSecretMap = { google: "cfg-google" };

    expect(getApiKey("google", secrets)).toBe("google");
    expect(getApiKeySource("google", secrets)).toEqual({
      sourceType: "env",
      envVar: "GOOGLE_API_KEY",
    });
  });

  test("detectProviderEnv reports source details", () => {
    process.env.FAL_API_KEY = "fal-key";
    const detections = detectProviderEnv({ openai: "cfg-openai" });

    const openai = detections.find((entry) => entry.provider === "openai");
    const fal = detections.find((entry) => entry.provider === "fal");

    expect(openai?.detected).toBe(true);
    expect(openai?.sourceType).toBe("config");
    expect(openai?.matchedSource).toBe("config.aiImg.secrets.openai");

    expect(fal?.detected).toBe(true);
    expect(fal?.sourceType).toBe("env");
    expect(fal?.matchedSource).toBe("FAL_API_KEY");
  });

  test("resolveProviderSelection throws when no provider is configured", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    expect(() => resolveProviderSelection(undefined, {})).toThrow("No provider detected");
  });
});
