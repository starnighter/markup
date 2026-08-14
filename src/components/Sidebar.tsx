import { useRef, useState } from "react";
import FileTree from "./FileTree";
import ResizeHandle from "./ResizeHandle";
import { useStore } from "../store";
import { isMobile, primaryModifier } from "../lib/platform";

export default function Sidebar() {
  const [query, setQuery] = useState("");
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
        <span className="sidebar-workspace-mark" aria-hidden="true">M</span>
        <span className="workspace-name" title={workspace}>{workspaceName}</span>
        <div className="sidebar-header-actions">
          <button className="icon-btn" title="收起侧栏" aria-label="收起侧栏" onClick={toggleSidebar}>‹</button>
          <button className="icon-btn" title="关闭工作区" aria-label="关闭工作区" onClick={closeWorkspace}>×</button>
        </div>
      </div>
      <label className="sidebar-search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索文档"
          aria-label="搜索文档"
        />
        {query ? (
          <button type="button" aria-label="清除搜索" title="清除搜索" onClick={() => setQuery("")}>×</button>
        ) : (
          <button
            type="button"
            className="sidebar-search-shortcut"
            title="快速打开文档"
            aria-label="快速打开文档"
            onClick={(event) => {
              event.preventDefault();
              window.dispatchEvent(new Event("markup:quick-open"));
            }}
          >
            <kbd>{primaryModifier} P</kbd>
          </button>
        )}
      </label>
      <div className="sidebar-actions">
        <button onClick={() => setCreating({ parent: workspace, isDir: false })}>＋ 新建文档</button>
        <button className="sidebar-action-icon" aria-label="新建文件夹" onClick={() => setCreating({ parent: workspace, isDir: true })}>□<sup>＋</sup></button>
        <button className="sidebar-action-icon" onClick={refreshTree} title="刷新" aria-label="刷新">↻</button>
      </div>
      <FileTree query={query} />
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
