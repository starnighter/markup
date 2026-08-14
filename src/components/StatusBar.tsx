import { useStore } from "../store";

export default function StatusBar() {
  const { currentFile, content, saving, saveError, dirty } = useStore();

  const status = saving ? "保存中…" : saveError ? "保存失败" : dirty ? "未保存" : "已保存";
  // 中文按字符计，英文按词计的混合统计
  const cjk = (content.match(/[一-鿿぀-ヿ가-힯]/g) || []).length;
  const words = (content.replace(/[一-鿿぀-ヿ가-힯]/g, " ").match(/\S+/g) || []).length;

  return (
    <footer className="statusbar">
      <span className="status-path" title={currentFile ?? ""}>
        {currentFile ?? "MarkUp — 离线 Markdown 编辑器"}
      </span>
      <span className="status-right">
        {currentFile && (
          <>
            <span>{cjk + words} 字</span>
            <span className={saveError ? "save-error" : ""}>{status}</span>
          </>
        )}
      </span>
    </footer>
  );
}
