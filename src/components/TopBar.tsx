import { useStore } from "../store";
import { primaryModifier } from "../lib/platform";

export default function TopBar() {
  const {
    currentFile,
    dirty,
    mode,
    setMode,
    theme,
    toggleTheme,
    toggleSidebar,
    workspace,
    workspaceName,
    rightPanelVisible,
    toggleRightPanel,
    navigationHistory,
    navigationIndex,
    navigateBack,
    navigateForward,
  } = useStore();

  const fileName = currentFile?.replace(/^[\\/]+/, "").split(/[\\/]/).pop() ?? "";
  const normalizedWorkspace = workspace?.replace(/\\/g, "/").replace(/\/+$/, "") ?? "";
  const normalizedFile = currentFile?.replace(/\\/g, "/") ?? "";
  const relativePath = normalizedWorkspace && normalizedFile.startsWith(normalizedWorkspace + "/")
    ? normalizedFile.slice(normalizedWorkspace.length + 1)
    : fileName;
  const parentLabel = relativePath.includes("/")
    ? relativePath.slice(0, relativePath.lastIndexOf("/"))
    : "";

  return (
    <header className="topbar">
      <div className="topbar-left">
        {workspace && (
          <button className="icon-btn" title="侧栏" onClick={toggleSidebar}>
            ☰
          </button>
        )}
        {currentFile && (
          <div className="history-nav" aria-label="文档导航">
            <button
              type="button"
              disabled={navigationIndex <= 0}
              title={`上一文档 (${primaryModifier}[)`}
              aria-label="上一文档"
              onClick={navigateBack}
            >
              ←
            </button>
            <button
              type="button"
              disabled={navigationIndex >= navigationHistory.length - 1}
              title={`下一文档 (${primaryModifier}])`}
              aria-label="下一文档"
              onClick={navigateForward}
            >
              →
            </button>
          </div>
        )}
        {!workspace && <span className="topbar-brand"><b>M</b> MarkUp</span>}
        <span className={`file-title ${!currentFile ? "workspace-title" : ""}`} title={currentFile ?? workspace ?? ""}>
          {currentFile ? (
            <>
              {parentLabel && <span className="file-parent">{parentLabel}<i>›</i></span>}
              <span className="file-name">{fileName}</span>
            </>
          ) : (workspace ? workspaceName : "")}
          {dirty && <span className="dirty-dot" title="未保存">●</span>}
        </span>
      </div>
      <div className="topbar-right">
        {currentFile && (
          <button
            className="icon-btn ai-open-btn"
            title="AI 服务配置"
            aria-label="AI 服务配置"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => window.dispatchEvent(new Event("markup:open-ai"))}
          >
            ✦
          </button>
        )}
        {currentFile && (
          <div className="mode-switch" role="tablist">
            <button
              className={mode === "ir" ? "active" : ""}
              onClick={() => setMode("ir")}
              title="Typora 式所见即所得渲染编辑"
            >
              预览
            </button>
            <button
              className={mode === "sv" ? "active" : ""}
              onClick={() => setMode("sv")}
              title="Markdown 源码 + 实时预览"
            >
              源码
            </button>
          </div>
        )}
        {currentFile && (
          <button
            className={`icon-btn ${rightPanelVisible ? "icon-btn-on" : ""}`}
            title={rightPanelVisible
              ? "收起右侧栏"
              : mode === "sv" ? "显示实时预览" : "显示文档大纲"}
            aria-label={rightPanelVisible ? "收起右侧栏" : "展开右侧栏"}
            aria-pressed={rightPanelVisible}
            onClick={toggleRightPanel}
          >
            ◧
          </button>
        )}
        <button className="icon-btn" title="切换主题" onClick={toggleTheme}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
