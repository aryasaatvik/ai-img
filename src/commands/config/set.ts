import { defineCommand } from "@bunli/core";

import {
  EDITABLE_CONFIG_KEYS,
  isEditableConfigKey,
  loadConfigFile,
  parseEditableConfigValue,
  resolveConfigWritePath,
  setConfigValue,
  writeConfigFile,
} from "../../lib/config";
import { fileOption, secretOption, targetOption } from "./options";

export const configSetCommand = defineCommand({
  name: "set",
  description: "Set a config key (supports dotted paths)",
  options: {
    target: targetOption,
    file: fileOption,
    secret: secretOption,
  },
  handler: async ({ flags, positional, cwd, prompt }) => {
    const key = positional[0];
    if (!key) {
      throw new Error("Usage: ai-img config set <key> [value]");
    }
    if (!isEditableConfigKey(key)) {
      throw new Error(
        `Unsupported key: ${key}. Allowed keys:\n- ${EDITABLE_CONFIG_KEYS.join("\n- ")}`,
      );
    }

    let rawValue = positional[1];
    const isSecretKey = key.startsWith("aiImg.secrets.");
    if (!rawValue && (flags.secret || isSecretKey)) {
      rawValue = (await prompt.password("Enter secret value")) as string;
    }
    if (!rawValue) {
      throw new Error("Missing value. Usage: ai-img config set <key> <value>");
    }

    const parsedValue = parseEditableConfigValue(key, rawValue);
    const path = resolveConfigWritePath({
      target: flags.target,
      cwd,
      file: flags.file,
    });

    const current = await loadConfigFile(path);
    const updated = setConfigValue(current, key, parsedValue);
    const aiImg = (updated.aiImg ?? {}) as Record<string, unknown>;
    if (aiImg.schemaVersion === undefined) {
      aiImg.schemaVersion = 1;
    }
    updated.aiImg = aiImg;
    await writeConfigFile(path, updated);
    console.log(`Updated ${key} in ${path}`);
  },
});

export default configSetCommand;
