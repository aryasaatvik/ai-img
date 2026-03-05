import {
  detectImageCapability,
  renderImage,
  resolveImageRenderMode,
  type ImageCapability,
  type ImageMimeType,
  type RenderImageOptions,
} from "@bunli/runtime/image";
import type { ResolvedAiImgRuntimeConfig } from "./config";

export type PreviewMode = "off" | "auto" | "on";

export interface PreviewFlagInput {
  "image-mode"?: PreviewMode;
}

export function resolvePreviewOptions(
  runtimeConfig: ResolvedAiImgRuntimeConfig,
  flags: PreviewFlagInput
): Pick<RenderImageOptions, "mode" | "protocol" | "width"> {
  const rawFlagMode = flags["image-mode"];
  const flagMode =
    rawFlagMode === "off" || rawFlagMode === "auto" || rawFlagMode === "on"
      ? rawFlagMode
      : undefined;

  return {
    mode: resolveImageRenderMode({
      flagMode,
      configMode: runtimeConfig.preview.mode,
      defaultMode: "auto",
    }),
    protocol: runtimeConfig.preview.protocol,
    width: runtimeConfig.preview.width,
  };
}

export function preflightStrictPreview(
  options: Pick<RenderImageOptions, "mode" | "protocol" | "width">,
  capability: ImageCapability = detectImageCapability()
): void {
  if (options.mode !== "on") {
    return;
  }

  if (capability.supported) {
    return;
  }

  const reason = capability.reason ?? "unsupported";
  throw new Error(`Preview unavailable in strict mode: ${reason}`);
}

export async function renderPreviewImage(
  imageBytes: Uint8Array,
  options: Pick<RenderImageOptions, "mode" | "protocol" | "width">,
  outputPath?: string
): Promise<{ rendered: boolean; reason?: string }> {
  const mimeType = detectPreviewMimeType(imageBytes, outputPath);
  if (!mimeType) {
    if (options.mode === "on") {
      throw new Error("Preview failed: unable to determine image MIME type");
    }
    return { rendered: false, reason: "invalid-input" };
  }

  const result = await renderImage(
    {
      kind: "bytes",
      bytes: imageBytes,
      mimeType,
    },
    options
  );
  if (!result.rendered && options.mode === "on") {
    throw new Error(`Preview failed: ${result.reason ?? "not-rendered"}`);
  }
  if (result.rendered) {
    process.stdout.write("\n");
  }
  return { rendered: result.rendered, reason: result.reason };
}

export function getPreviewCapability() {
  return detectImageCapability();
}

export function detectPreviewMimeType(
  imageBytes: Uint8Array,
  outputPath?: string
): ImageMimeType | undefined {
  if (imageBytes.length >= 8) {
    if (
      imageBytes[0] === 0x89 &&
      imageBytes[1] === 0x50 &&
      imageBytes[2] === 0x4e &&
      imageBytes[3] === 0x47 &&
      imageBytes[4] === 0x0d &&
      imageBytes[5] === 0x0a &&
      imageBytes[6] === 0x1a &&
      imageBytes[7] === 0x0a
    ) {
      return "image/png";
    }
  }

  if (imageBytes.length >= 3) {
    if (imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff) {
      return "image/jpeg";
    }
  }

  if (imageBytes.length >= 12) {
    if (
      imageBytes[0] === 0x52 && // R
      imageBytes[1] === 0x49 && // I
      imageBytes[2] === 0x46 && // F
      imageBytes[3] === 0x46 && // F
      imageBytes[8] === 0x57 && // W
      imageBytes[9] === 0x45 && // E
      imageBytes[10] === 0x42 && // B
      imageBytes[11] === 0x50 // P
    ) {
      return "image/webp";
    }
  }

  if (!outputPath) {
    return undefined;
  }

  const normalizedPath = outputPath.toLowerCase();
  if (normalizedPath.endsWith(".png")) return "image/png";
  if (normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) return "image/jpeg";
  if (normalizedPath.endsWith(".webp")) return "image/webp";

  return undefined;
}
