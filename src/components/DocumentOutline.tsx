import { RefObject, useMemo } from "react";
import { useStore } from "../store";
import { extractHeadings } from "../lib/headings";

interface DocumentOutlineProps {
  editorRef: RefObject<HTMLDivElement>;
}

/** 所见即所得模式的右侧辅助栏：展示文档结构，并可跳转到对应标题。 */
export default function DocumentOutline({ editorRef }: DocumentOutlineProps) {
  const content = useStore((state) => state.content);
  const toggleRightPanel = useStore((state) => state.toggleRightPanel);
  const headings = useMemo(() => extractHeadings(content), [content]);

  const jumpTo = (index: number) => {
    const rendered = editorRef.current?.querySelectorAll(
      ".vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6"
    );
    const target = rendered?.item(index) as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <aside className="document-outline" aria-label="文档大纲">
      <div className="document-outline-header">
        <span>文档大纲</span>
        <button className="icon-btn" title="收起右侧栏" onClick={toggleRightPanel}>»</button>
      </div>
      {headings.length ? (
        <nav className="document-outline-list" aria-label="标题列表">
          {headings.map((heading) => (
            <button
              type="button"
              key={`${heading.index}-${heading.text}`}
              className="document-outline-item"
              style={{ paddingLeft: 12 + (heading.level - 1) * 14 }}
              title={heading.text}
              onClick={() => jumpTo(heading.index)}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      ) : (
        <p className="document-outline-empty">当前文档没有标题</p>
      )}
    </aside>
  );
}
