import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";

const pathName = (path: string) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
const parentPath = (path: string) => path.replace(/[\\/]+$/, "").replace(/[\\/][^\\/]+$/, "");

export default function Welcome() {
  const { openWorkspace, showToast, recentWorkspaces, forgetRecentWorkspace } = useStore();

  const pick = async () => {
    try {
      const dir = await open({ directory: true, title: "选择 Markdown 工作区文件夹" });
      if (typeof dir === "string") await openWorkspace(dir);
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  return (
    <main className="welcome">
      <div className="welcome-shell">
        <section className="welcome-start">
          <div className="welcome-logo" aria-hidden="true">M</div>
          <h1>MarkUp</h1>
          <p>离线 Markdown 编辑器</p>
          <button className="primary-btn welcome-open-btn" onClick={pick}>打开文件夹</button>
          <small><i /> 文件只保存在你的设备上</small>
        </section>

        {recentWorkspaces.length > 0 && (
          <section className="recent-section" aria-labelledby="recent-title">
            <div className="recent-heading">
              <h2 id="recent-title">最近工作区</h2>
              <button className="text-btn" onClick={pick}>浏览其他文件夹</button>
            </div>
            <div className="recent-grid">
              {recentWorkspaces.map((path) => (
                <div className="recent-card" key={path} title={path}>
                  <button className="recent-open" onClick={() => openWorkspace(path)}>
                    <span className="recent-icon">M</span>
                    <span className="recent-copy">
                      <b>{pathName(path)}</b>
                      <small>{parentPath(path)}</small>
                    </span>
                  </button>
                  <button
                    className="recent-remove"
                    title="从最近列表移除"
                    aria-label={`移除 ${pathName(path)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      forgetRecentWorkspace(path);
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
