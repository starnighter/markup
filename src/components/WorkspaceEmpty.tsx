import { useStore } from "../store";
import { primaryModifier } from "../lib/platform";

export default function WorkspaceEmpty() {
  const { workspace, workspaceName, setCreating, toggleSidebar, sidebarOpen } = useStore();
  if (!workspace) return null;

  const createDocument = () => {
    if (!sidebarOpen) toggleSidebar();
    setCreating({ parent: workspace, isDir: false });
  };

  return (
    <div className="workspace-empty">
      <div className="workspace-empty-visual" aria-hidden="true">
        <span className="empty-sheet empty-sheet-back" />
        <span className="empty-sheet empty-sheet-front"><i /><i /><i /></span>
        <b>＋</b>
      </div>
      <span className="section-kicker">{workspaceName.toLocaleUpperCase()}</span>
      <h2>开始一篇新文档</h2>
      <p>从侧栏选择已有 Markdown 文件，或创建一个空白文档开始记录。</p>
      <div className="workspace-empty-actions">
        <button className="primary-btn" onClick={createDocument}>＋ 新建文档</button>
        {!sidebarOpen && <button className="secondary-btn" onClick={toggleSidebar}>浏览文件</button>}
      </div>
      <small>提示：按 <kbd>{primaryModifier} P</kbd> 可以随时搜索文档</small>
    </div>
  );
}
