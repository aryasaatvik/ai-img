import { describe, expect, test } from "bun:test";

import type { ImageCapability } from "@bunli/runtime/image";

import type { ResolvedAiImgRuntimeConfig } from "./config";
import { detectPreviewMimeType, preflightStrictPreview, resolvePreviewOptions } from "./preview";

const baseRuntimeConfig: ResolvedAiImgRuntimeConfig = {
  defaults: {
    size: "1024x1024",
    output: "output.png",
  },
  generate: {
    count: 1,
  },
  edit: {
    count: 1,
  },
  batch: {
    concurrency: 5,
    maxAttempts: 3,
  },
  preview: {
    mode: "auto",
    protocol: "auto",
    width: 32,
  },
  secrets: {},
};

describe("preview config resolution", () => {
  test("uses config values when no flag is present", () => {
    const options = resolvePreviewOptions(
      {
        ...baseRuntimeConfig,
        preview: {
          mode: "on",
          protocol: "kitty",
          width: 72,
        },
      },
      {},
    );

    expect(options.mode).toBe("on");
    expect(options.protocol).toBe("kitty");
    expect(options.width).toBe(72);
  });

  test("flag overrides config mode", () => {
    const options = resolvePreviewOptions(
      {
        ...baseRuntimeConfig,
        preview: {
          mode: "off",
          protocol: "auto",
        },
      },
      { "image-mode": "on" },
    );

    expect(options.mode).toBe("on");
    expect(options.protocol).toBe("auto");
  });
});

describe("strict preview preflight", () => {
  test("throws in strict mode when capability is unsupported", () => {
    const unsupported: ImageCapability = {
      supported: false,
      protocol: "none",
      reason: "not-interactive",
    };
    expect(() =>
      preflightStrictPreview({ mode: "on", protocol: "auto", width: 32 }, unsupported),
    ).toThrow("Preview unavailable in strict mode: not-interactive");
  });

  test("does not throw when strict mode is supported", () => {
    const supported: ImageCapability = {
      supported: true,
      protocol: "kitty",
    };
    expect(() =>
      preflightStrictPreview({ mode: "on", protocol: "kitty", width: 32 }, supported),
    ).not.toThrow();
  });
});

describe("preview mime detection", () => {
  test("detects png and jpeg from magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    expect(detectPreviewMimeType(png)).toBe("image/png");
    expect(detectPreviewMimeType(jpeg)).toBe("image/jpeg");
  });

  test("detects webp from riff header", () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectPreviewMimeType(webp)).toBe("image/webp");
  });

  test("falls back to output extension when bytes are unknown", () => {
    const unknown = new Uint8Array([0x00, 0x11, 0x22, 0x33]);

    expect(detectPreviewMimeType(unknown, "out.jpg")).toBe("image/jpeg");
    expect(detectPreviewMimeType(unknown, "out.webp")).toBe("image/webp");
    expect(detectPreviewMimeType(unknown, "out.png")).toBe("image/png");
  });
});
