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
  const { workspace, currentFile, sidebarOpen, toggleSidebar, theme, toast, init } = useStore();

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
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") useStore.getState().saveNow();
      else if (key === "[") useStore.getState().navigateBack();
      else if (key === "]") useStore.getState().navigateForward();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        {workspace && sidebarOpen && (
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
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
