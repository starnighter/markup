import { create } from "zustand";
import { fsApi, DirEntry, joinPath, isMarkdown } from "./lib/fs";
import { isMobile } from "./lib/platform";

export type EditorMode = "ir" | "sv";
export type Theme = "light" | "dark";

interface AppState {
  workspace: string | null;
  workspaceName: string;
  recentWorkspaces: string[];
  tree: DirEntry | null;
  expanded: Record<string, boolean>;
  currentFile: string | null;
  /** 编辑器当前内容（保存的唯一事实来源） */
  content: string;
  savedContent: string;
  dirty: boolean;
  saving: boolean;
  saveError: boolean;
  mode: EditorMode;
  theme: Theme;
  sidebarOpen: boolean;
  /** 侧栏宽度（px），可拖拽调整 */
  sidebarWidth: number;
  /** 源码模式下预览窗格宽度占比 0~1 */
  svRatio: number;
  /** 通用右侧辅助栏：源码模式为实时预览，所见即所得模式为文档大纲 */
  rightPanelVisible: boolean;
  toast: string | null;
  /** 正在内联重命名的路径 */
  renaming: string | null;
  /** 正在内联创建的位置 */
  creating: { parent: string; isDir: boolean } | null;

  showToast: (msg: string) => void;
  openWorkspace: (path: string) => Promise<void>;
  closeWorkspace: () => void;
  forgetRecentWorkspace: (path: string) => void;
  refreshTree: () => Promise<void>;
  toggleExpanded: (path: string) => void;
  openFile: (path: string) => Promise<void>;
  closeFile: () => void;
  setContent: (c: string) => void;
  saveNow: () => Promise<void>;
  setMode: (m: EditorMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setSvRatio: (r: number) => void;
  toggleRightPanel: () => void;
  setRenaming: (p: string | null) => void;
  setCreating: (c: { parent: string; isDir: boolean } | null) => void;
  createEntry: (parent: string, name: string, isDir: boolean) => Promise<void>;
  renameEntry: (oldPath: string, newName: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  init: () => Promise<void>;
}

const LS_WORKSPACE = "markup.workspace";
const LS_RECENT_WORKSPACES = "markup.recentWorkspaces";
const LS_THEME = "markup.theme";
const LS_MODE = "markup.mode";
const LS_SIDEBAR_W = "markup.sidebarWidth";
const LS_SV_RATIO = "markup.svRatio";
const LS_RIGHT_PANEL = "markup.rightPanelVisible";
const LEGACY_LS_SV_PREVIEW = "markup.svPreviewVisible";

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;
const SV_MIN = 0.15;
const SV_MAX = 0.85;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function readRecentWorkspaces(): string[] {
  try {
    const value = JSON.parse(storage.get(LS_RECENT_WORKSPACES) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((path): path is string => typeof path === "string" && !!path.trim()).slice(0, 6);
  } catch {
    return [];
  }
}

/** 安全 localStorage：Node 测试环境/隐私模式下静默降级 */
const storage = {
  get(k: string): string | null {
    try {
      const ls = globalThis.localStorage;
      return typeof ls?.getItem === "function" ? ls.getItem(k) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      const ls = globalThis.localStorage;
      if (typeof ls?.setItem === "function") ls.setItem(k, v);
    } catch { /* ignore */ }
  },
  remove(k: string) {
    try {
      const ls = globalThis.localStorage;
      if (typeof ls?.removeItem === "function") ls.removeItem(k);
    } catch { /* ignore */ }
  },
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppState>((set, get) => ({
  workspace: null,
  workspaceName: "",
  recentWorkspaces: readRecentWorkspaces(),
  tree: null,
  expanded: {},
  currentFile: null,
  content: "",
  savedContent: "",
  dirty: false,
  saving: false,
  saveError: false,
  mode: (storage.get(LS_MODE) as EditorMode) || (isMobile ? "sv" : "ir"),
  theme: (storage.get(LS_THEME) as Theme) || "light",
  sidebarOpen: !isMobile,
  sidebarWidth: clamp(Number(storage.get(LS_SIDEBAR_W)) || 264, SIDEBAR_MIN, SIDEBAR_MAX),
  svRatio: clamp(Number(storage.get(LS_SV_RATIO)) || 0.5, SV_MIN, SV_MAX),
  // 兼容旧版本的源码预览开关偏好。
  rightPanelVisible: (storage.get(LS_RIGHT_PANEL) ?? storage.get(LEGACY_LS_SV_PREVIEW)) !== "0",
  toast: null,
  renaming: null,
  creating: null,

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 5000);
  },

  openWorkspace: async (path) => {
    try {
      const tree = await fsApi.readDirTree(path);
      const recentWorkspaces = [path, ...get().recentWorkspaces.filter((item) => item !== path)].slice(0, 6);
      storage.set(LS_WORKSPACE, path);
      storage.set(LS_RECENT_WORKSPACES, JSON.stringify(recentWorkspaces));
      set({
        workspace: path,
        workspaceName: tree.name,
        recentWorkspaces,
        tree,
        expanded: { [path]: true },
        currentFile: null,
        content: "",
        savedContent: "",
        dirty: false,
        sidebarOpen: !isMobile,
      });
    } catch (e) {
      get().showToast((e as Error).message);
      storage.remove(LS_WORKSPACE);
    }
  },

  closeWorkspace: () => {
    storage.remove(LS_WORKSPACE);
    set({
      workspace: null,
      workspaceName: "",
      tree: null,
      expanded: {},
      currentFile: null,
      content: "",
      savedContent: "",
      dirty: false,
    });
  },

  forgetRecentWorkspace: (path) =>
    set((state) => {
      const recentWorkspaces = state.recentWorkspaces.filter((item) => item !== path);
      storage.set(LS_RECENT_WORKSPACES, JSON.stringify(recentWorkspaces));
      return { recentWorkspaces };
    }),

  refreshTree: async () => {
    const { workspace, showToast } = get();
    if (!workspace) return;
    try {
      const tree = await fsApi.readDirTree(workspace);
      set({ tree });
    } catch (e) {
      showToast((e as Error).message);
    }
  },

  toggleExpanded: (path) =>
    set((s) => ({ expanded: { ...s.expanded, [path]: !s.expanded[path] } })),

  openFile: async (path) => {
    const s = get();
    if (s.currentFile === path) {
      if (isMobile) set({ sidebarOpen: false });
      return;
    }
    await s.saveNow(); // 先落盘当前文件
    try {
      const content = await fsApi.readTextFile(path);
      set({
        currentFile: path,
        content,
        savedContent: content,
        dirty: false,
        saveError: false,
        sidebarOpen: isMobile ? false : s.sidebarOpen,
      });
    } catch (e) {
      s.showToast((e as Error).message);
    }
  },

  closeFile: () => {
    set({ currentFile: null, content: "", savedContent: "", dirty: false });
  },

  setContent: (content) =>
    set((s) => ({ content, dirty: content !== s.savedContent })),

  saveNow: async () => {
    const s = get();
    if (!s.currentFile || !s.dirty || s.saving) return;
    set({ saving: true, saveError: false });
    try {
      await fsApi.writeTextFile(s.currentFile, s.content);
      set({ saving: false, dirty: false, savedContent: get().content });
    } catch (e) {
      set({ saving: false, saveError: true });
      s.showToast("保存失败：" + (e as Error).message);
    }
  },

  setMode: (mode) => {
    storage.set(LS_MODE, mode);
    set({ mode });
  },

  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === "light" ? "dark" : "light";
      storage.set(LS_THEME, theme);
      return { theme };
    }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setSidebarWidth: (w) => {
    const sidebarWidth = clamp(Math.round(w), SIDEBAR_MIN, SIDEBAR_MAX);
    storage.set(LS_SIDEBAR_W, String(sidebarWidth));
    set({ sidebarWidth });
  },

  setSvRatio: (r) => {
    const svRatio = clamp(r, SV_MIN, SV_MAX);
    storage.set(LS_SV_RATIO, String(svRatio));
    set({ svRatio });
  },

  toggleRightPanel: () =>
    set((s) => {
      storage.set(LS_RIGHT_PANEL, s.rightPanelVisible ? "0" : "1");
      return { rightPanelVisible: !s.rightPanelVisible };
    }),
  setRenaming: (p) => set({ renaming: p }),
  setCreating: (c) => set({ creating: c }),

  createEntry: async (parent, name, isDir) => {
    const s = get();
    let finalName = name.trim();
    if (!finalName) throw new Error("名称不能为空");
    if (!isDir && !isMarkdown(finalName)) finalName += ".md";
    const path = joinPath(parent, finalName);
    try {
      await fsApi.createEntry(path, isDir);
      await s.refreshTree();
      set({ creating: null });
      if (!isDir) await get().openFile(path);
    } catch (e) {
      s.showToast((e as Error).message);
      throw e;
    }
  },

  renameEntry: async (oldPath, newName) => {
    const s = get();
    const finalName = newName.trim();
    set({ renaming: null });
    if (!finalName) return;
    const parent = oldPath.replace(/[\\/][^\\/]*$/, "");
    const newPath = joinPath(parent, finalName);
    if (newPath === oldPath) return;
    try {
      await fsApi.renameEntry(oldPath, newPath);
      // 若重命名的是当前打开的文件，同步路径
      if (get().currentFile === oldPath) set({ currentFile: newPath });
      await s.refreshTree();
    } catch (e) {
      s.showToast((e as Error).message);
    }
  },

  deleteEntry: async (path) => {
    const s = get();
    try {
      await fsApi.deleteEntry(path);
      if (get().currentFile === path || get().currentFile?.startsWith(path + "/")) {
        get().closeFile();
      }
      await s.refreshTree();
    } catch (e) {
      s.showToast((e as Error).message);
    }
  },

  init: async () => {
    const saved = storage.get(LS_WORKSPACE);
    if (saved) await get().openWorkspace(saved);
  },
}));
