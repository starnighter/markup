import { useEffect } from "react";
import { useStore } from "./store";
import Sidebar from "./components/Sidebar";
import EditorView from "./components/EditorView";
import TopBar from "./components/TopBar";
import StatusBar from "./components/StatusBar";
import Welcome from "./components/Welcome";
import WorkspaceEmpty from "./components/WorkspaceEmpty";
import QuickOpen from "./components/QuickOpen";
import { isMobile } from "./lib/platform";

export default function App() {
  const { workspace, currentFile, sidebarOpen, toggleSidebar, focusMode, toggleFocusMode, theme, toast, init } = useStore();

  // 启动：恢复上次工作区
  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题应用到 <html data-theme>
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 全局保存与文档导航快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().focusMode) {
        // 快速打开、AI 设置等模态框优先消费 Esc，不连带退出专注模式。
        const fromModal = e.composedPath().some(
          (target) => target instanceof HTMLElement && target.getAttribute("aria-modal") === "true",
        );
        if (fromModal) return;
        e.preventDefault();
        useStore.getState().toggleFocusMode();
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") useStore.getState().saveNow();
      else if (key === "[") useStore.getState().navigateBack();
      else if (key === "]") useStore.getState().navigateForward();
      else if (key === "enter" && e.shiftKey && useStore.getState().currentFile) useStore.getState().toggleFocusMode();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`app ${focusMode ? "focus-mode" : ""}`}>
      <TopBar />
      <div className="main">
        {workspace && sidebarOpen && !focusMode && (
          <>
            <Sidebar />
            {isMobile && <div className="sidebar-mask" onClick={toggleSidebar} />}
          </>
        )}
        <div className="content-area">
          {!workspace ? (
            <Welcome />
          ) : currentFile ? (
            <EditorView />
          ) : (
            <WorkspaceEmpty />
          )}
        </div>
      </div>
      <StatusBar />
      <QuickOpen />
      {focusMode && currentFile && (
        <div className="focus-hud" aria-label="专注模式">
          <span title={currentFile}>{currentFile.replace(/^[\\/]+/, "").split(/[\\/]/).pop()}</span>
          <button type="button" onClick={toggleFocusMode} aria-label="退出专注模式">
            退出专注 <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
