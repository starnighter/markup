import { useEffect } from "react";
import { useStore } from "./store";
import Sidebar from "./components/Sidebar";
import EditorView from "./components/EditorView";
import TopBar from "./components/TopBar";
import StatusBar from "./components/StatusBar";
import Welcome from "./components/Welcome";
import WorkspaceEmpty from "./components/WorkspaceEmpty";
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

  // 全局保存快捷键 Cmd/Ctrl + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        useStore.getState().saveNow();
      }
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
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
