import { invoke } from "@tauri-apps/api/core";

export type AIProtocol = "openai-chat" | "anthropic";

export interface AIPreset {
  id: string;
  label: string;
  protocol: AIProtocol;
  baseUrl: string;
  model: string;
  requiresKey: boolean;
}

/**
 * 常用服务的起始配置。它们只是可编辑预设，模型名和地址均可由用户覆盖。
 * OpenAI-compatible 服务统一使用 Chat Completions 格式。
 */
export const AI_PRESETS: AIPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai-chat",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    requiresKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    protocol: "openai-chat",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    requiresKey: true,
  },
  {
    id: "anthropic",
    label: "Claude",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-haiku-4-5",
    requiresKey: true,
  },
  {
    id: "gemini",
    label: "Gemini",
    protocol: "openai-chat",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.6-flash",
    requiresKey: true,
  },
  {
    id: "qwen",
    label: "通义千问",
    protocol: "openai-chat",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    requiresKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "~openai/gpt-latest",
    requiresKey: true,
  },
  {
    id: "ollama",
    label: "Ollama（本地）",
    protocol: "openai-chat",
    baseUrl: "http://localhost:11434/v1",
    model: "gpt-oss:20b",
    requiresKey: false,
  },
  {
    id: "custom",
    label: "自定义",
    protocol: "openai-chat",
    baseUrl: "",
    model: "",
    requiresKey: false,
  },
];

export const DEFAULT_AI_PRESET = AI_PRESETS[0];

export interface AISettings {
  presetId: string;
  protocol: AIProtocol;
  baseUrl: string;
  model: string;
  apiKeys: Record<string, string>;
}

export const AI_SETTINGS_STORAGE_KEY = "markup.aiSettings";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function defaultAISettings(): AISettings {
  return {
    presetId: DEFAULT_AI_PRESET.id,
    protocol: DEFAULT_AI_PRESET.protocol,
    baseUrl: DEFAULT_AI_PRESET.baseUrl,
    model: DEFAULT_AI_PRESET.model,
    apiKeys: {},
  };
}

export function loadAISettings(storage?: SettingsStorage): AISettings {
  const fallback = defaultAISettings();
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target?.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<AISettings>;
    const preset = AI_PRESETS.find((item) => item.id === value.presetId);
    const protocol = value.protocol === "anthropic" || value.protocol === "openai-chat"
      ? value.protocol
      : preset?.protocol ?? fallback.protocol;
    const apiKeys = Object.fromEntries(
      Object.entries(value.apiKeys ?? {}).filter(
        ([key, apiKey]) => typeof key === "string" && typeof apiKey === "string" && apiKey.length <= 512,
      ),
    );
    return {
      presetId: preset?.id ?? fallback.presetId,
      protocol,
      baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : preset?.baseUrl ?? fallback.baseUrl,
      model: typeof value.model === "string" ? value.model : preset?.model ?? fallback.model,
      apiKeys,
    };
  } catch {
    return fallback;
  }
}

export function saveAISettings(settings: AISettings, storage?: SettingsStorage): boolean {
  try {
    const target = storage ?? globalThis.localStorage;
    target?.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return !!target;
  } catch {
    return false;
  }
}

export interface AIRequest {
  providerName: string;
  protocol: AIProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  instruction: string;
  context: string;
}

export async function completeWithAI(request: AIRequest): Promise<string> {
  try {
    return await invoke<string>("ai_complete", { request });
  } catch (error) {
    throw new Error(typeof error === "string" ? error : (error as Error).message || String(error));
  }
}
