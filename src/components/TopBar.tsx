import { useStore } from "../store";

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
  } = useStore();

  const fileName = currentFile?.replace(/^[\\/]+/, "").split(/[\\/]/).pop() ?? "";

  return (
    <header className="topbar">
      <div className="topbar-left">
        {workspace && (
          <button className="icon-btn" title="侧栏" onClick={toggleSidebar}>
            ☰
          </button>
        )}
        {!workspace && <span className="topbar-brand"><b>M</b> MarkUp</span>}
        <span className={`file-title ${!currentFile ? "workspace-title" : ""}`}>
          {fileName || (workspace ? workspaceName : "")}
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
