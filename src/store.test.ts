import { beforeEach, describe, expect, it, vi } from "vitest";

// mock Tauri IPC
const files = new Map<string, string>();
let failWrites = false;
let heldWrite: Promise<void> | null = null;
let notifyWriteStarted: (() => void) | null = null;
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
    switch (cmd) {
      case "read_dir_tree":
        return {
          name: "ws",
          path: "/ws",
          is_dir: true,
          children: [
            { name: "a.md", path: "/ws/a.md", is_dir: false, children: [] },
            { name: "b.md", path: "/ws/b.md", is_dir: false, children: [] },
            {
              name: "notes",
              path: "/ws/notes",
              is_dir: true,
              children: [{ name: "draft.md", path: "/ws/notes/draft.md", is_dir: false, children: [] }],
            },
          ],
        };
      case "read_text_file":
        return files.get(args.path as string) ?? "# hello";
      case "write_text_file":
        if (failWrites) throw new Error("disk full");
        if (heldWrite) {
          notifyWriteStarted?.();
          await heldWrite;
          heldWrite = null;
        }
        files.set(args.path as string, args.content as string);
        return;
      default:
        throw new Error("unknown cmd " + cmd);
    }
  }),
  convertFileSrc: (p: string) => "asset://" + p,
}));

import { useStore } from "./store";

describe("store", () => {
  beforeEach(() => {
    try { globalThis.localStorage?.clear?.(); } catch { /* node 内建 localStorage 不可用时跳过 */ }
    files.clear();
    failWrites = false;
    heldWrite = null;
    notifyWriteStarted = null;
    useStore.setState({
      workspace: null,
      workspaceName: "",
      recentWorkspaces: [],
      lastOpenedFiles: {},
      tree: null,
      currentFile: null,
      navigationHistory: [],
      navigationIndex: -1,
      content: "",
      savedContent: "",
      dirty: false,
      saving: false,
      mode: "ir",
      focusMode: false,
      rightPanelVisible: true,
    });
  });

  it("打开工作区后加载目录树", async () => {
    await useStore.getState().openWorkspace("/ws");
    const s = useStore.getState();
    expect(s.workspaceName).toBe("ws");
    expect(s.tree?.children[0].name).toBe("a.md");
    expect(s.expanded["/ws"]).toBe(true);
  });

  it("记录、去重并移除最近工作区", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openWorkspace("/another");
    await useStore.getState().openWorkspace("/ws");
    expect(useStore.getState().recentWorkspaces).toEqual(["/ws", "/another"]);

    useStore.getState().forgetRecentWorkspace("/another");
    expect(useStore.getState().recentWorkspaces).toEqual(["/ws"]);
  });

  it("打开文件 → 编辑 → 脏标记 → 保存落盘", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    expect(useStore.getState().content).toBe("# hello");
    expect(useStore.getState().dirty).toBe(false);
    expect(useStore.getState().lastOpenedFiles["/ws"]).toBe("/ws/a.md");

    useStore.getState().setContent("# hello\n\n改动");
    expect(useStore.getState().dirty).toBe(true);

    await useStore.getState().saveNow();
    const s = useStore.getState();
    expect(s.dirty).toBe(false);
    expect(files.get("/ws/a.md")).toBe("# hello\n\n改动");
  });

  it("重新打开工作区时恢复最后编辑的有效文档", async () => {
    useStore.setState({ lastOpenedFiles: { "/ws": "/ws/notes/draft.md" } });
    await useStore.getState().openWorkspace("/ws");
    expect(useStore.getState().currentFile).toBe("/ws/notes/draft.md");
    expect(useStore.getState().content).toBe("# hello");
    expect(useStore.getState().expanded["/ws/notes"]).toBe(true);
  });

  it("最后编辑的文档已不存在时清理失效记录", async () => {
    useStore.setState({ lastOpenedFiles: { "/ws": "/ws/missing.md" } });
    await useStore.getState().openWorkspace("/ws");
    expect(useStore.getState().currentFile).toBeNull();
    expect(useStore.getState().lastOpenedFiles["/ws"]).toBeUndefined();
  });

  it("改回原内容时脏标记消除", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    useStore.getState().setContent("x");
    useStore.getState().setContent("# hello");
    expect(useStore.getState().dirty).toBe(false);
  });

  it("切换文件前自动保存旧文件", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    useStore.getState().setContent("改动内容");
    files.set("/ws/b.md", "# B");
    await useStore.getState().openFile("/ws/b.md");
    expect(files.get("/ws/a.md")).toBe("改动内容");
    expect(useStore.getState().content).toBe("# B");
  });

  it("支持在已打开文档之间后退与前进", async () => {
    files.set("/ws/a.md", "# A");
    files.set("/ws/b.md", "# B");
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    await useStore.getState().openFile("/ws/b.md");

    expect(useStore.getState().navigationHistory).toEqual(["/ws/a.md", "/ws/b.md"]);
    expect(useStore.getState().navigationIndex).toBe(1);

    await useStore.getState().navigateBack();
    expect(useStore.getState().currentFile).toBe("/ws/a.md");
    expect(useStore.getState().content).toBe("# A");
    expect(useStore.getState().navigationIndex).toBe(0);

    await useStore.getState().navigateForward();
    expect(useStore.getState().currentFile).toBe("/ws/b.md");
    expect(useStore.getState().navigationIndex).toBe(1);
  });

  it("后退后打开新文档会丢弃原前进分支", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    await useStore.getState().openFile("/ws/b.md");
    await useStore.getState().navigateBack();
    await useStore.getState().openFile("/ws/notes/draft.md");

    expect(useStore.getState().navigationHistory).toEqual(["/ws/a.md", "/ws/notes/draft.md"]);
    expect(useStore.getState().navigationIndex).toBe(1);
  });

  it("旧文档保存失败时中止切换并保留编辑内容", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    useStore.getState().setContent("尚未落盘的内容");
    failWrites = true;

    const opened = await useStore.getState().openFile("/ws/b.md");
    expect(opened).toBe(false);
    expect(useStore.getState().currentFile).toBe("/ws/a.md");
    expect(useStore.getState().content).toBe("尚未落盘的内容");
    expect(useStore.getState().dirty).toBe(true);
    expect(useStore.getState().saveError).toBe(true);
  });

  it("保存过程中继续编辑会把最新内容一并落盘", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    let releaseWrite!: () => void;
    heldWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const writeStarted = new Promise<void>((resolve) => { notifyWriteStarted = resolve; });

    useStore.getState().setContent("第一版");
    const saving = useStore.getState().saveNow();
    await writeStarted;
    useStore.getState().setContent("保存期间写下的最新版");
    releaseWrite();
    await saving;

    expect(files.get("/ws/a.md")).toBe("保存期间写下的最新版");
    expect(useStore.getState().dirty).toBe(false);
    expect(useStore.getState().saving).toBe(false);
  });

  it("切换编辑模式时自动收起不同用途的右侧栏", () => {
    useStore.getState().setMode("sv");
    expect(useStore.getState().rightPanelVisible).toBe(false);

    useStore.getState().toggleRightPanel();
    expect(useStore.getState().rightPanelVisible).toBe(true);

    useStore.getState().setMode("ir");
    expect(useStore.getState().rightPanelVisible).toBe(false);

    useStore.getState().toggleRightPanel();
    expect(useStore.getState().rightPanelVisible).toBe(true);
    useStore.getState().setMode("ir");
    expect(useStore.getState().rightPanelVisible).toBe(true);
  });

  it("专注模式可切换并在关闭文件时自动退出", async () => {
    await useStore.getState().openWorkspace("/ws");
    await useStore.getState().openFile("/ws/a.md");
    useStore.getState().toggleFocusMode();
    expect(useStore.getState().focusMode).toBe(true);

    useStore.getState().closeFile();
    expect(useStore.getState().focusMode).toBe(false);
  });
});
