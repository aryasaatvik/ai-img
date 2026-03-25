import { afterEach, describe, expect, test } from "bun:test";

import {
  convertSizeToAspectRatio,
  describeKeySource,
  detectProviderEnv,
  formatImageWarning,
  getApiKey,
  getApiKeySource,
  getModel,
  getModelPreset,
  resolveImageDimensions,
  resolveProviderSelection,
  type ProviderSecretMap,
} from "./provider";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "FAL_API_KEY",
  "FAL_KEY",
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

  test("exposes blessed model presets", () => {
    expect(getModelPreset("google", "gemini-3.1-flash-image-preview")).toMatchObject({
      supportsSize: false,
      supportsAspectRatio: true,
      defaultAspectRatio: "1:1",
    });
    expect(getModelPreset("fal", "unknown-model")).toBeUndefined();
  });

  test("convertSizeToAspectRatio reduces image sizes", () => {
    expect(convertSizeToAspectRatio("1024x1024")).toBe("1:1");
    expect(convertSizeToAspectRatio("1536x1024")).toBe("3:2");
  });

  test("resolveImageDimensions uses blessed Google aspect ratio defaults", () => {
    expect(
      resolveImageDimensions({
        provider: "google",
        model: "gemini-3.1-flash-image-preview",
      }),
    ).toEqual({
      aspectRatio: "1:1",
      source: "preset",
      presetMatched: true,
    });

    expect(
      resolveImageDimensions({
        provider: "google",
        model: "gemini-3.1-flash-image-preview",
        configSize: "1536x1024",
      }),
    ).toEqual({
      aspectRatio: "3:2",
      source: "config",
      presetMatched: true,
    });
  });

  test("resolveImageDimensions leaves unknown models at provider defaults", () => {
    expect(
      resolveImageDimensions({
        provider: "fal",
        model: "fal-ai/custom-model",
      }),
    ).toEqual({
      source: "none",
      presetMatched: false,
    });
  });

  test("resolveImageDimensions rejects unsupported explicit aspect ratios", () => {
    expect(() =>
      resolveImageDimensions({
        provider: "openai",
        model: "gpt-image-1.5",
        aspectRatio: "16:9",
      }),
    ).toThrow("does not support aspect ratio");
  });

  test("formatImageWarning renders warning objects readably", () => {
    expect(
      formatImageWarning({
        type: "unsupported",
        feature: "size",
        details: "This model does not support the `size` option.",
      }),
    ).toBe("size: This model does not support the `size` option.");
    expect(formatImageWarning({ message: "hello" })).toBe("hello");
  });

  test("getModel injects config-backed fal API key into provider requests", async () => {
    delete process.env.FAL_API_KEY;
    delete process.env.FAL_KEY;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );

      if (url === "https://fal.run/fal-ai/flux/dev") {
        expect(headers.get("Authorization")).toBe("Key cfg-fal");
        return new Response(
          JSON.stringify({
            images: [{ url: "https://example.com/image.png" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "https://example.com/image.png") {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    try {
      const model = getModel("fal", "fal-ai/flux/dev", { fal: "cfg-fal" });

      const result = await model.doGenerate({
        prompt: "coffee beans",
        n: 1,
        size: "1024x1024",
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
        files: [],
        mask: undefined,
      });

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      if (!(result.images[0] instanceof Uint8Array)) {
        throw new Error("Expected fal image result to be Uint8Array");
      }
      expect(Array.from(result.images[0])).toEqual([1, 2, 3]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
