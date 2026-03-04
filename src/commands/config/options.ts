import { option } from "@bunli/core";
import { z } from "zod";

export const targetOption = option(z.enum(["user", "project"]).default("user"), {
  short: "t",
  description: "Config target: user or project",
});

export const fileOption = option(z.string().optional(), {
  description: "Custom config file path",
});

export const forceOption = option(z.coerce.boolean().default(false), {
  short: "f",
  description: "Overwrite target file if it already exists",
});

export const secretOption = option(z.coerce.boolean().default(false), {
  description: "Treat the value as a secret (prompts securely when omitted)",
});
