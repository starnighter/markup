import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { DirEntry, isMarkdown } from "../lib/fs";
import { filterDirEntry } from "../lib/fileSearch";

/** 内联输入框：用于新建与重命名。输入为空时（Enter 或点击别处）自动取消 */
function InlineInput({
  defaultValue,
  depth,
  onCommit,
  onCancel,
}: {
  defaultValue: string;
  depth: number;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const dot = defaultValue.lastIndexOf(".");
    ref.current?.setSelectionRange(0, dot > 0 ? dot : defaultValue.length);
  }, [defaultValue]);

  const done = (v: string) => (v.trim() ? onCommit(v) : onCancel());

  return (
    <div className="tree-row editing" style={{ paddingLeft: 12 + depth * 14 }}>
      <input
        ref={ref}
        defaultValue={defaultValue}
        onKeyDown={(e) => {
          if (e.key === "Enter") done((e.target as HTMLInputElement).value);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={(e) => done(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ConfirmDelete({ entry, onClose }: { entry: DirEntry; onClose: () => void }) {
  const deleteEntry = useStore((s) => s.deleteEntry);
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p>
          确定删除{entry.is_dir ? "文件夹" : "文件"} <b>{entry.name}</b> 吗？
          {entry.is_dir && "（其中所有内容都会被删除）"}
        </p>
        <p className="modal-warn">此操作不可撤销。</p>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button
            className="danger-btn"
            onClick={async () => {
              await deleteEntry(entry.path);
              onClose();
            }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

interface MenuState {
  x: number;
  y: number;
  entry: DirEntry | null; // null = 空白区域
}

function TreeNode({
  entry,
  depth,
  onMenu,
  onConfirmDelete,
  searching,
}: {
  entry: DirEntry;
  depth: number;
  onMenu: (m: MenuState) => void;
  onConfirmDelete: (e: DirEntry) => void;
  searching: boolean;
}) {
  const {
    expanded,
    toggleExpanded,
    openFile,
    currentFile,
    renaming,
    setRenaming,
    renameEntry,
    setCreating,
  } = useStore();

  const isOpen = searching || !!expanded[entry.path];
  const isActive = currentFile === entry.path;
  const editable = entry.is_dir || isMarkdown(entry.name);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editable) onMenu({ x: e.clientX, y: e.clientY, entry });
  };

  if (renaming === entry.path) {
    return (
      <>
        <InlineInput
          defaultValue={entry.name}
          depth={depth}
          onCommit={(v) => renameEntry(entry.path, v)}
          onCancel={() => setRenaming(null)}
        />
        {entry.is_dir && isOpen &&
          entry.children.map((c) => (
            <TreeNode key={c.path} entry={c} depth={depth + 1} onMenu={onMenu} onConfirmDelete={onConfirmDelete} searching={searching} />
          ))}
      </>
    );
  }

  return (
    <>
      <div
        className={[
          "tree-row",
          entry.is_dir ? "dir" : "file",
          isActive ? "active" : "",
          editable ? "" : "disabled",
        ].join(" ")}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => {
          if (entry.is_dir) toggleExpanded(entry.path);
          else if (isMarkdown(entry.name)) openFile(entry.path);
        }}
        onDoubleClick={() => editable && setRenaming(entry.path)}
        onContextMenu={openMenu}
      >
        <span className="tree-icon">
          {entry.is_dir ? (isOpen ? "▾" : "▸") : isMarkdown(entry.name) ? "📄" : "·"}
        </span>
        <span className="tree-name" title={entry.path}>
          {entry.name}
        </span>
        {editable && (
          <span className="tree-actions" onClick={(e) => e.stopPropagation()}>
            {entry.is_dir && (
              <>
                <button
                  title="新建文件"
                  onClick={() => setCreating({ parent: entry.path, isDir: false })}
                >
                  ＋
                </button>
                <button
                  title="新建文件夹"
                  onClick={() => setCreating({ parent: entry.path, isDir: true })}
                >
                  🗀
                </button>
              </>
            )}
            <button title="重命名" onClick={() => setRenaming(entry.path)}>
              ✎
            </button>
            <button title="删除" onClick={() => onConfirmDelete(entry)}>
              ✕
            </button>
          </span>
        )}
      </div>
      {entry.is_dir && isOpen &&
        entry.children.map((c) => (
          <TreeNode key={c.path} entry={c} depth={depth + 1} onMenu={onMenu} onConfirmDelete={onConfirmDelete} searching={searching} />
        ))}
    </>
  );
}

/** 新建条目的内联输入（挂在 creating.parent 对应目录下、根级别则由 FileTree 渲染） */
export function CreatingRow({ parent, depth }: { parent: string; depth: number }) {
  const { creating, setCreating, createEntry } = useStore();
  if (!creating || creating.parent !== parent) return null;
  return (
    <InlineInput
      defaultValue={creating.isDir ? "新建文件夹" : "未命名.md"}
      depth={depth}
      onCommit={async (v) => {
        try {
          await createEntry(parent, v, creating.isDir);
        } catch {
          /* toast 已提示，保持输入框 */
        }
      }}
      onCancel={() => setCreating(null)}
    />
  );
}

/** 右键菜单 */
function ContextMenu({
  menu,
  workspace,
  onClose,
  onConfirmDelete,
}: {
  menu: MenuState;
  workspace: string;
  onClose: () => void;
  onConfirmDelete: (e: DirEntry) => void;
}) {
  const { setCreating, setRenaming, refreshTree, expanded, toggleExpanded } = useStore();

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);

  const entry = menu.entry;
  const dir = entry ? (entry.is_dir ? entry.path : entry.path.replace(/[\\/][^\\/]*$/, "")) : workspace;

  const createIn = (isDir: boolean) => {
    if (entry?.is_dir && !expanded[entry.path]) toggleExpanded(entry.path);
    setCreating({ parent: dir, isDir });
    onClose();
  };

  const item = (label: string, fn: () => void) => (
    <button
      className="ctx-item"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={fn}
    >
      {label}
    </button>
  );

  return (
    <div
      className="context-menu"
      style={{
        left: Math.min(menu.x, window.innerWidth - 180),
        top: Math.min(menu.y, window.innerHeight - 180),
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item("新建文件", () => createIn(false))}
      {item("新建文件夹", () => createIn(true))}
      {entry && (
        <>
          <div className="ctx-sep" />
          {item("重命名", () => {
            setRenaming(entry.path);
            onClose();
          })}
          {item("删除", () => {
            onConfirmDelete(entry);
            onClose();
          })}
        </>
      )}
      {!entry && (
        <>
          <div className="ctx-sep" />
          {item("刷新", () => {
            refreshTree();
            onClose();
          })}
        </>
      )}
    </div>
  );
}

export default function FileTree({ query = "" }: { query?: string }) {
  const { tree, workspace } = useStore();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirming, setConfirming] = useState<DirEntry | null>(null);

  // 新建时确保父目录展开（hook 必须在 early return 之前）
  useEffectAutoExpand(useStore((s) => s.creating?.parent));
  if (!tree || !workspace) return null;
  const searching = !!query.trim();
  const children = tree.children
    .map((entry) => filterDirEntry(entry, query))
    .filter((entry): entry is DirEntry => entry !== null);

  return (
    <div
      className="file-tree"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, entry: null });
      }}
    >
      {!searching && <CreatingRow parent={tree.path} depth={0} />}
      {children.map((c) => (
        <TreeNode key={c.path} entry={c} depth={0} onMenu={setMenu} onConfirmDelete={setConfirming} searching={searching} />
      ))}
      {searching && children.length === 0 && (
        <div className="file-tree-empty">
          <span>⌕</span>
          <p>没有找到“{query.trim()}”</p>
        </div>
      )}
      {menu && (
        <ContextMenu
          menu={menu}
          workspace={workspace}
          onClose={() => setMenu(null)}
          onConfirmDelete={setConfirming}
        />
      )}
      {confirming && <ConfirmDelete entry={confirming} onClose={() => setConfirming(null)} />}
    </div>
  );
}

function useEffectAutoExpand(parent: string | null | undefined) {
  useEffect(() => {
    const { expanded } = useStore.getState();
    if (parent && !expanded[parent]) {
      useStore.getState().toggleExpanded(parent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent]);
}
