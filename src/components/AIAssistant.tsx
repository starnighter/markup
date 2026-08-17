import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import Vditor from "vditor";
import { useStore } from "../store";
import {
  AI_PRESETS,
  AIProtocol,
  AISettings,
  DEFAULT_AI_PRESET,
  completeWithAI,
  loadAISettings,
  saveAISettings,
} from "../lib/ai";

interface AIAssistantProps {
  editorRef: RefObject<HTMLDivElement>;
  vditorRef: RefObject<Vditor>;
}

type ApplyMode = "replace" | "after";

interface QuickAction {
  label: string;
  prompt: string;
  mode: ApplyMode;
}

interface SelectionTool {
  text: string;
  left: number;
  top: number;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "润色",
    prompt: "润色以下内容，使表达更清晰自然，保持原意和 Markdown 格式。",
    mode: "replace",
  },
  {
    label: "续写",
    prompt: "自然续写以下内容，保持原有语言、语气和 Markdown 格式。只返回续写的新内容。",
    mode: "after",
  },
  {
    label: "总结",
    prompt: "总结以下内容，保留关键信息，使用简洁的 Markdown。",
    mode: "replace",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** AI 服务配置与编辑器选区快捷操作。 */
export default function AIAssistant({ editorRef, vditorRef }: AIAssistantProps) {
  const [initialSettings] = useState(loadAISettings);
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState(initialSettings.presetId);
  const [apiKeys, setApiKeys] = useState(initialSettings.apiKeys);
  const [protocol, setProtocol] = useState<AIProtocol>(initialSettings.protocol);
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [selectedText, setSelectedText] = useState("");
  const [error, setError] = useState("");
  const [selectionTool, setSelectionTool] = useState<SelectionTool | null>(null);
  const [selectionLoading, setSelectionLoading] = useState("");
  const savedRange = useRef<Range | null>(null);
  const savedSettings = useRef<AISettings>(initialSettings);
  const activePreset = AI_PRESETS.find((item) => item.id === presetId) ?? DEFAULT_AI_PRESET;
  const apiKey = apiKeys[presetId] ?? "";

  const applySettings = useCallback((settings: AISettings) => {
    setPresetId(settings.presetId);
    setProtocol(settings.protocol);
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setApiKeys(settings.apiKeys);
  }, []);

  const openSettings = useCallback((message = "") => {
    applySettings(savedSettings.current);
    setSelectionTool(null);
    setError(message);
    setOpen(true);
  }, [applySettings]);

  const closeSettings = useCallback(() => {
    applySettings(savedSettings.current);
    setError("");
    setOpen(false);
  }, [applySettings]);

  const readEditorSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return { range: range.cloneRange(), text, rect };
  }, [editorRef]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (open) {
          setSelectionTool(null);
          return;
        }
        if (selectionLoading) return;
        const current = readEditorSelection();
        if (!current) {
          setSelectionTool(null);
          return;
        }
        savedRange.current = current.range;
        setSelectedText(current.text);
        const toolbarWidth = 236;
        const left = clamp(
          current.rect.left + current.rect.width / 2 - toolbarWidth / 2,
          8,
          window.innerWidth - toolbarWidth - 8,
        );
        const top = current.rect.top > 54
          ? current.rect.top - 44
          : current.rect.bottom + 8;
        setSelectionTool({ text: current.text, left, top });
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, readEditorSelection, selectionLoading]);

  useEffect(() => {
    const show = () => openSettings();
    window.addEventListener("markup:open-ai", show);
    return () => window.removeEventListener("markup:open-ai", show);
  }, [openSettings]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeSettings, open]);

  const restoreRange = (range = savedRange.current) => {
    if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) {
      vditorRef.current?.focus();
      return false;
    }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  };

  const insertAtSavedRange = (text: string, mode: ApplyMode) => {
    const vditor = vditorRef.current;
    if (!vditor || !text.trim()) return;
    const restored = restoreRange();
    if (mode === "replace" && restored) {
      vditor.deleteValue();
      vditor.insertValue(text.trim());
    } else if (mode === "after" && restored) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      range?.collapse(false);
      if (range) {
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      vditor.insertValue(`\n\n${text.trim()}`);
    } else {
      vditor.insertValue(text.trim());
    }
    setSelectionTool(null);
  };

  const runSelectionAction = async (action: QuickAction) => {
    if (!baseUrl.trim() || !model.trim() || (activePreset.requiresKey && !apiKey.trim())) {
      openSettings("请先完善 Base URL、模型和 API Key，保存后即可使用选区 AI 功能。");
      return;
    }
    const operationRange = savedRange.current?.cloneRange() ?? null;
    const operationText = selectionTool?.text || selectedText;
    if (!operationRange || !operationText) return;
    setSelectionLoading(action.label);
    try {
      const response = await completeWithAI({
        providerName: activePreset.label,
        protocol,
        baseUrl,
        apiKey,
        model,
        instruction: action.prompt,
        context: operationText,
      });
      savedRange.current = operationRange;
      setSelectedText(operationText);
      insertAtSavedRange(response, action.mode);
      useStore.getState().showToast(`${action.label}完成`);
    } catch (e) {
      useStore.getState().showToast(`AI ${action.label}失败：${(e as Error).message}`);
    } finally {
      setSelectionLoading("");
    }
  };

  const saveSettings = () => {
    const trimmedUrl = baseUrl.trim();
    const trimmedModel = model.trim();
    if (!trimmedUrl || !trimmedModel || (activePreset.requiresKey && !apiKey.trim())) {
      setError("请填写完整的 Base URL、模型和 API Key。");
      return;
    }
    try {
      const url = new URL(trimmedUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      setError("Base URL 必须是有效的 HTTP/HTTPS 地址，且不能包含账号密码。");
      return;
    }
    const next: AISettings = {
      presetId,
      protocol,
      baseUrl: trimmedUrl,
      model: trimmedModel,
      apiKeys: { ...apiKeys, [presetId]: apiKey.trim() },
    };
    if (!saveAISettings(next)) {
      setError("保存失败，请检查应用存储权限。");
      return;
    }
    savedSettings.current = next;
    applySettings(next);
    setError("");
    setOpen(false);
    useStore.getState().showToast("AI 配置已保存");
  };

  return (
    <>
      {(selectionTool || selectionLoading) && !open && (
        <div
          className="ai-selection-toolbar"
          style={selectionTool ? { left: selectionTool.left, top: selectionTool.top } : undefined}
          role="toolbar"
          aria-label="AI 选区操作"
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className="ai-selection-brand" aria-hidden="true">✦</span>
          {selectionLoading ? (
            <span className="ai-selection-working"><i />AI 正在{selectionLoading}…</span>
          ) : (
            QUICK_ACTIONS.map((action) => (
              <button key={action.label} type="button" onClick={() => runSelectionAction(action)}>
                {action.label}
              </button>
            ))
          )}
          {!selectionLoading && (
            <button
              className="ai-selection-more"
              type="button"
              title="打开 AI 服务配置"
              aria-label="打开 AI 服务配置"
              onClick={() => openSettings()}
            >
              •••
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="modal-mask ai-mask" onMouseDown={closeSettings}>
          <section
            className="ai-dialog ai-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="ai-header">
              <div className="ai-heading">
                <span className="ai-brand-mark" aria-hidden="true">✦</span>
                <div>
                  <h2 id="ai-title">AI 服务配置</h2>
                  <p>供选区浮条的润色、续写和总结使用</p>
                </div>
              </div>
              <button className="ai-close-btn" title="关闭" onClick={closeSettings}>×</button>
            </header>

            <div className="ai-body">
              <section className="ai-config-card">
                <div className="ai-config-top">
                  <label className="ai-field">
                    <span>服务预设</span>
                    <select
                      aria-label="服务预设"
                      value={presetId}
                      onChange={(event) => {
                        const next = AI_PRESETS.find((item) => item.id === event.target.value) ?? DEFAULT_AI_PRESET;
                        setPresetId(next.id);
                        setProtocol(next.protocol);
                        setBaseUrl(next.baseUrl);
                        setModel(next.model);
                        setError("");
                      }}
                    >
                      {AI_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="ai-field">
                    <span>API 格式</span>
                    <select
                      aria-label="API 格式"
                      value={protocol}
                      onChange={(event) => setProtocol(event.target.value as AIProtocol)}
                    >
                      <option value="openai-chat">OpenAI Chat Completions</option>
                      <option value="anthropic">Anthropic Messages</option>
                    </select>
                  </label>
                </div>
                <div className="ai-config-grid">
                  <label className="ai-field ai-base-url-field">
                    <span>Base URL</span>
                    <input
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      spellCheck={false}
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                  <label className="ai-field">
                    <span>API Key{activePreset.requiresKey ? "" : "（可选）"}</span>
                    <input
                      type="password"
                      value={apiKey}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={activePreset.requiresKey ? `输入 ${activePreset.label} API Key` : "本地服务通常可留空"}
                      onChange={(event) => setApiKeys((old) => ({ ...old, [presetId]: event.target.value }))}
                    />
                  </label>
                  <label className="ai-field">
                    <span>模型</span>
                    <input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} />
                  </label>
                </div>
                <p className="ai-memory-note"><span aria-hidden="true">●</span> 可填 API 根地址或完整 endpoint</p>
              </section>
              {error && <p className="ai-error" role="alert">{error}</p>}
            </div>

            <footer className="ai-footer">
              <p>配置保存在本机应用存储中，并非系统钥匙串</p>
              <div className="ai-actions">
                <button type="button" onClick={closeSettings}>取消</button>
                <button type="button" className="primary-btn" onClick={saveSettings}>保存配置</button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
