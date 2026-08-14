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
      <div className="welcome-glow welcome-glow-one" />
      <div className="welcome-glow welcome-glow-two" />
      <div className="welcome-shell">
        <section className="welcome-hero">
          <div className="welcome-copy">
            <div className="welcome-eyebrow"><span>✦</span> 为专注写作而生</div>
            <h1>把想法写下来，<br /><em>其余交给 MarkUp。</em></h1>
            <p className="welcome-lead">
              一个安静、快速、离线优先的 Markdown 工作台。从草稿到长文，专注内容，不被工具打断。
            </p>
            <div className="welcome-actions">
              <button className="primary-btn welcome-open-btn" onClick={pick}>
                <span>打开工作区</span><i aria-hidden="true">→</i>
              </button>
              <span className="welcome-local-note"><i /> 文件始终留在本机</span>
            </div>
            <div className="welcome-features" aria-label="主要特性">
              <span><b>⌘</b> 专注编辑</span>
              <span><b>↔</b> 实时预览</span>
              <span><b>✦</b> AI 辅助</span>
            </div>
          </div>

          <div className="welcome-preview" aria-hidden="true">
            <div className="preview-window">
              <div className="preview-top">
                <span className="preview-brand">M</span>
                <div className="preview-dots"><i /><i /><i /></div>
              </div>
              <div className="preview-body">
                <aside>
                  <span className="preview-label">WORKSPACE</span>
                  <div className="preview-file active"><i />product-notes.md</div>
                  <div className="preview-file"><i />ideas.md</div>
                  <div className="preview-file"><i />research.md</div>
                </aside>
                <article>
                  <span className="preview-kicker">Product notes</span>
                  <h2>Design for clarity.</h2>
                  <p>Great tools should feel invisible. They help ideas move from thought to page without adding friction.</p>
                  <div className="preview-quote">“Write first. Refine later.”</div>
                  <div className="preview-lines"><i /><i /><i /></div>
                </article>
              </div>
              <div className="preview-ai-chip">✦ 润色 · 续写 · 总结</div>
            </div>
          </div>
        </section>

        {recentWorkspaces.length > 0 && (
          <section className="recent-section" aria-labelledby="recent-title">
            <div className="recent-heading">
              <div>
                <span className="section-kicker">CONTINUE WRITING</span>
                <h2 id="recent-title">最近的工作区</h2>
              </div>
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
