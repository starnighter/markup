import { useRef } from "react";
import FileTree from "./FileTree";
import ResizeHandle from "./ResizeHandle";
import { useStore } from "../store";
import { isMobile } from "../lib/platform";

export default function Sidebar() {
  const {
    workspace,
    workspaceName,
    sidebarWidth,
    setSidebarWidth,
    toggleSidebar,
    setCreating,
    refreshTree,
    closeWorkspace,
  } = useStore();
  const asideRef = useRef<HTMLElement>(null);
  if (!workspace) return null;

  return (
    <aside
      className="sidebar"
      ref={asideRef}
      style={isMobile ? undefined : { width: sidebarWidth }}
    >
      <div className="sidebar-header">
        <span className="workspace-name" title={workspace}>
          {workspaceName}
        </span>
        <button className="icon-btn" title="收起侧栏" onClick={toggleSidebar}>
          «
        </button>
        <button className="icon-btn" title="关闭工作区" onClick={closeWorkspace}>
          ⏏
        </button>
      </div>
      <div className="sidebar-actions">
        <button onClick={() => setCreating({ parent: workspace, isDir: false })}>＋ 文件</button>
        <button onClick={() => setCreating({ parent: workspace, isDir: true })}>＋ 文件夹</button>
        <button onClick={refreshTree} title="刷新">
          ⟳
        </button>
      </div>
      <FileTree />
      {!isMobile && (
        <ResizeHandle
          onDrag={(x) => {
            const left = asideRef.current?.getBoundingClientRect().left ?? 0;
            setSidebarWidth(x - left);
          }}
          onDoubleClick={() => setSidebarWidth(264)}
        />
      )}
    </aside>
  );
}
