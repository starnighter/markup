import { describe, expect, it } from "vitest";
import {
  AI_PRESETS,
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_PRESET,
  defaultAISettings,
  loadAISettings,
  saveAISettings,
} from "./ai";

describe("AI provider presets", () => {
  it("provides unique editable presets with valid URLs", () => {
    expect(new Set(AI_PRESETS.map((preset) => preset.id)).size).toBe(AI_PRESETS.length);
    for (const preset of AI_PRESETS.filter((item) => item.id !== "custom")) {
      expect(() => new URL(preset.baseUrl)).not.toThrow();
      expect(preset.model).not.toBe("");
    }
  });

  it("covers native Anthropic and keyless local services", () => {
    expect(AI_PRESETS.find((item) => item.id === "anthropic")?.protocol).toBe("anthropic");
    expect(AI_PRESETS.find((item) => item.id === "ollama")?.requiresKey).toBe(false);
    expect(DEFAULT_AI_PRESET.id).toBe("deepseek");
  });

  it("saves and restores the selected connection including its API key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const settings = {
      ...defaultAISettings(),
      presetId: "openrouter",
      baseUrl: "https://gateway.example.com/v1",
      model: "writing-model",
      apiKeys: { openrouter: "saved-key" },
    };

    expect(saveAISettings(settings, storage)).toBe(true);
    expect(values.has(AI_SETTINGS_STORAGE_KEY)).toBe(true);
    expect(loadAISettings(storage)).toEqual(settings);
  });

  it("falls back safely when saved configuration is broken", () => {
    const storage = {
      getItem: () => "{broken",
      setItem: () => {},
    };
    expect(loadAISettings(storage)).toEqual(defaultAISettings());
  });
});
