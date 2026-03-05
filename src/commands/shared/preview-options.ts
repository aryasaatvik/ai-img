import { option } from "@bunli/core";
import { z } from "zod";

export const imageModeOption = option(z.enum(["off", "auto", "on"]).optional(), {
  description: "Terminal image preview mode (off, auto, on)",
});

