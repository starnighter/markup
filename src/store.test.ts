import { beforeEach, describe, expect, it, vi } from "vitest";

// mock Tauri IPC
const files = new Map<string, string>();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
    switch (cmd) {
      case "read_dir_tree":
        return {
          name: "ws",
          path: "/ws",
          is_dir: true,
          children: [{ name: "a.md", path: "/ws/a.md", is_dir: false, children: [] }],
        };
      case "read_text_file":
        return files.get(args.path as string) ?? "# hello";
      case "write_text_file":
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
    useStore.setState({
      workspace: null,
      workspaceName: "",
      recentWorkspaces: [],
      tree: null,
      currentFile: null,
      content: "",
      savedContent: "",
      dirty: false,
      saving: false,
      mode: "ir",
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

    useStore.getState().setContent("# hello\n\n改动");
    expect(useStore.getState().dirty).toBe(true);

    await useStore.getState().saveNow();
    const s = useStore.getState();
    expect(s.dirty).toBe(false);
    expect(files.get("/ws/a.md")).toBe("# hello\n\n改动");
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

  it("右侧栏开关跨编辑模式保持通用", () => {
    useStore.getState().setMode("sv");
    useStore.getState().toggleRightPanel();
    expect(useStore.getState().rightPanelVisible).toBe(false);

    useStore.getState().setMode("ir");
    expect(useStore.getState().rightPanelVisible).toBe(false);
    useStore.getState().toggleRightPanel();
    expect(useStore.getState().rightPanelVisible).toBe(true);
  });
});
