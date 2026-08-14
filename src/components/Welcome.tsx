import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";

export default function Welcome() {
  const { openWorkspace, showToast } = useStore();

  const pick = async () => {
    try {
      const dir = await open({ directory: true, title: "选择 Markdown 工作区文件夹" });
      if (typeof dir === "string") await openWorkspace(dir);
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-logo">M↓</div>
        <h1>MarkUp</h1>
        <p>离线、跨平台的 Markdown 阅读与编辑器</p>
        <button className="primary-btn" onClick={pick}>
          打开文件夹
        </button>
        <p className="welcome-hint">选择一个文件夹作为工作区，所有内容只保存在你的设备上</p>
      </div>
    </div>
  );
}
