import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { QuickOpenItem, searchMarkdownFiles } from "../lib/quickOpen";
import { primaryModifier } from "../lib/platform";

export default function QuickOpen() {
  const { workspace, tree, currentFile, navigationHistory, openFile } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const items = useMemo(() => {
    if (!tree || !workspace) return [];
    if (query.trim()) return searchMarkdownFiles(tree, workspace, query, 12);
    const recentRank = new Map(navigationHistory.map((path, index) => [path, index]));
    return searchMarkdownFiles(tree, workspace, "", Number.MAX_SAFE_INTEGER)
      .sort((a, b) => (recentRank.get(b.path) ?? -1) - (recentRank.get(a.path) ?? -1))
      .slice(0, 12);
  }, [navigationHistory, query, tree, workspace]);

  useEffect(() => {
    const show = () => {
      if (!useStore.getState().workspace) return;
      setOpen(true);
      setQuery("");
      setSelected(0);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("markup:quick-open", show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("markup:quick-open", show);
    };
  }, []);

  useEffect(() => {
    if (!workspace) setOpen(false);
  }, [workspace]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (selected >= items.length) setSelected(Math.max(0, items.length - 1));
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [items.length, selected]);

  if (!open || !workspace || !tree) return null;

  const choose = async (item: QuickOpenItem) => {
    if (await openFile(item.path)) setOpen(false);
  };

  return (
    <div className="quick-open-mask" onMouseDown={() => setOpen(false)}>
      <section
        className="quick-open-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="快速打开文档"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <div className="quick-open-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            placeholder="输入文件名或路径…"
            aria-label="搜索要打开的文档"
            aria-controls="quick-open-results"
            aria-activedescendant={items[selected] ? `quick-open-item-${selected}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && items.length) {
                event.preventDefault();
                setSelected((index) => (index + 1) % items.length);
              } else if (event.key === "ArrowUp" && items.length) {
                event.preventDefault();
                setSelected((index) => (index - 1 + items.length) % items.length);
              } else if (event.key === "Enter" && items[selected]) {
                event.preventDefault();
                void choose(items[selected]);
              }
            }}
          />
          <kbd>{primaryModifier} P</kbd>
        </div>
        <div className="quick-open-meta">
          <span>{query.trim() ? `${items.length} 个匹配文档` : "最近打开与全部文档"}</span>
          <small>{workspace}</small>
        </div>
        <div className="quick-open-results" id="quick-open-results" role="listbox">
          {items.map((item, index) => (
            <button
              id={`quick-open-item-${index}`}
              key={item.path}
              ref={index === selected ? activeRef : null}
              type="button"
              role="option"
              aria-selected={index === selected}
              className={index === selected ? "active" : ""}
              onMouseEnter={() => setSelected(index)}
              onClick={() => void choose(item)}
            >
              <span className="quick-open-file-mark">M</span>
              <span className="quick-open-copy">
                <b>{item.name}</b>
                <small>{item.parent}</small>
              </span>
              {item.path === currentFile && <span className="quick-open-current">当前</span>}
            </button>
          ))}
          {items.length === 0 && (
            <div className="quick-open-empty">
              <span>⌕</span>
              <p>没有找到匹配的 Markdown 文档</p>
            </div>
          )}
        </div>
        <footer className="quick-open-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 打开</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </footer>
      </section>
    </div>
  );
}
