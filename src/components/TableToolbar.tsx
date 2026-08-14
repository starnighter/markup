import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  caretTargetBeforeDelete,
  deleteCol,
  deleteRow,
  deleteTable,
  insertCol,
  insertRow,
  locateCell,
  type CellPos,
} from "../lib/tableTools";

type MenuState = { x: number; y: number };
type TableAction =
  | "row-above"
  | "row-below"
  | "col-left"
  | "col-right"
  | "delete-row"
  | "delete-col"
  | "delete-table";

interface ToolbarPoint {
  left: number;
  top: number;
}

interface TableToolbarProps {
  hostRef: RefObject<HTMLDivElement>;
}

/** 只接受编辑区中的真实 th/td，排除预览窗格里的只读表格。 */
function editableCell(target: EventTarget | null, host: HTMLElement): HTMLTableCellElement | null {
  if (!(target instanceof Element)) return null;
  const cell = target.closest("th, td") as HTMLTableCellElement | null;
  if (!cell || !host.contains(cell)) return null;
  const editor = cell.closest("[contenteditable='true']");
  return editor && editor.classList.contains("vditor-reset") ? cell : null;
}

function moveCaret(target: HTMLElement | null) {
  if (!target || !target.isConnected) return;
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  target.focus({ preventScroll: true });
}

/** 通知 Vditor 从变更后的 DOM 重新生成 Markdown，并触发其 input 回调。 */
function commitDomChange(editor: HTMLElement) {
  const init: InputEventInit = {
    bubbles: true,
    composed: true,
    inputType: "insertText",
  };
  const event = typeof InputEvent === "function"
    ? new InputEvent("input", init)
    : new Event("input", { bubbles: true, composed: true });
  editor.dispatchEvent(event);
}

/** Obsidian 式表格工具：选中单元格后显示快捷工具条，右键提供完整行列操作。 */
export default function TableToolbar({ hostRef }: TableToolbarProps) {
  const [active, setActive] = useState<CellPos | null>(null);
  const [point, setPoint] = useState<ToolbarPoint | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const activeRef = useRef<CellPos | null>(null);

  const selectCell = useCallback((cell: HTMLTableCellElement | null) => {
    const next = cell?.isConnected ? locateCell(cell) : null;
    activeRef.current = next;
    setActive(next);
    if (!next) {
      setPoint(null);
      setMenu(null);
    }
  }, []);

  const positionToolbar = useCallback(() => {
    const current = activeRef.current;
    const host = hostRef.current;
    if (!current?.table.isConnected || !host) {
      selectCell(null);
      return;
    }

    const tableRect = current.table.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    if (
      tableRect.bottom < hostRect.top ||
      tableRect.top > hostRect.bottom ||
      tableRect.right < hostRect.left ||
      tableRect.left > hostRect.right
    ) {
      setPoint(null);
      return;
    }

    // 工具条宽约 174px；右侧有空间时放到表外，避免压住紧邻表格的标题/正文。
    const width = 174;
    const fitsRight = hostRect.right - tableRect.right >= width + 16;
    setPoint(fitsRight
      ? {
          left: tableRect.right + 8,
          top: Math.max(hostRect.top + 6, tableRect.top),
        }
      : {
          left: Math.max(hostRect.left + 8, Math.min(tableRect.right - width, hostRect.right - width - 8)),
          top: Math.max(hostRect.top + 6, tableRect.top - 36),
        });
  }, [hostRef, selectCell]);

  useEffect(() => {
    positionToolbar();
  }, [active, positionToolbar]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const activate = (event: Event) => {
      const cell = editableCell(event.target, host);
      if (cell) selectCell(cell);
    };
    const openMenu = (event: MouseEvent) => {
      const cell = editableCell(event.target, host);
      if (!cell) return;
      event.preventDefault();
      event.stopPropagation();
      selectCell(cell);
      setMenu({ x: event.clientX, y: event.clientY });
    };
    const closeFromOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".table-tool-ui")) return;
      if (editableCell(event.target, host)) return;
      selectCell(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };

    host.addEventListener("pointerdown", activate);
    host.addEventListener("focusin", activate);
    host.addEventListener("contextmenu", openMenu);
    document.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", positionToolbar);
    // capture=true 可以收到 Vditor 内部滚动容器的 scroll。
    window.addEventListener("scroll", positionToolbar, true);
    return () => {
      host.removeEventListener("pointerdown", activate);
      host.removeEventListener("focusin", activate);
      host.removeEventListener("contextmenu", openMenu);
      document.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", positionToolbar);
      window.removeEventListener("scroll", positionToolbar, true);
    };
  }, [hostRef, positionToolbar, selectCell]);

  const run = (action: TableAction) => {
    const current = activeRef.current;
    if (!current?.table.isConnected) return;
    const { table, row, col, isHeader } = current;
    const editor = table.closest("[contenteditable='true']") as HTMLElement | null;
    if (!editor) return;
    const tableIndex = Array.from(editor.querySelectorAll("table")).indexOf(table);

    let target: HTMLElement | null = null;
    let nextPos: { row: number; col: number } | null = null;
    if (action === "row-above" || action === "row-below") {
      const where = action === "row-above" ? "above" : "below";
      insertRow(table, row, where);
      const insertedRow = isHeader ? 1 : where === "above" ? row : row + 1;
      target = table.rows[insertedRow]?.cells[Math.min(col, table.rows[insertedRow].cells.length - 1)] ?? null;
      nextPos = target ? { row: insertedRow, col: target.cellIndex } : null;
    } else if (action === "col-left" || action === "col-right") {
      const where = action === "col-left" ? "left" : "right";
      insertCol(table, col, where);
      const insertedCol = where === "left" ? col : col + 1;
      target = table.rows[row]?.cells[insertedCol] ?? null;
      nextPos = target ? { row, col: insertedCol } : null;
    } else if (action === "delete-row") {
      if (isHeader) return;
      target = caretTargetBeforeDelete(table, row, col, "row") ?? editor;
      const targetCell = target.closest("th, td") as HTMLTableCellElement | null;
      if (targetCell?.closest("table") === table) {
        const pos = locateCell(targetCell);
        nextPos = { row: pos.row, col: pos.col };
      }
      moveCaret(target);
      deleteRow(table, row);
    } else if (action === "delete-col") {
      target = caretTargetBeforeDelete(table, row, col, "col") ?? editor;
      const targetCell = target.closest("th, td") as HTMLTableCellElement | null;
      if (targetCell?.closest("table") === table) {
        const pos = locateCell(targetCell);
        nextPos = { row: pos.row, col: pos.col > col ? pos.col - 1 : pos.col };
      }
      moveCaret(target);
      deleteCol(table, col);
    } else {
      target = caretTargetBeforeDelete(table, row, col, "table") ?? editor;
      moveCaret(target);
      deleteTable(table);
    }

    if (action.startsWith("row-") || action.startsWith("col-")) moveCaret(target);
    commitDomChange(editor);
    setMenu(null);

    // IR 可能在 input 处理中重建当前块，不能继续持有变更前的 cell 引用。
    const refreshedTable = Array.from(editor.querySelectorAll("table"))[tableIndex] as HTMLTableElement | undefined;
    const nextCell = nextPos
      ? refreshedTable?.rows[nextPos.row]?.cells[nextPos.col] ?? null
      : null;
    if (nextCell?.isConnected) {
      moveCaret(nextCell);
      selectCell(nextCell);
      requestAnimationFrame(positionToolbar);
    } else {
      selectCell(null);
    }
  };

  if (!active || !point) return null;

  const menuLeft = menu ? Math.max(8, Math.min(menu.x, window.innerWidth - 190)) : 0;
  const menuTop = menu ? Math.max(8, Math.min(menu.y, window.innerHeight - 282)) : 0;
  const item = (label: string, action: TableAction, danger = false, disabled = false) => (
    <button
      type="button"
      className={`table-menu-item${danger ? " danger" : ""}`}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => run(action)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div
        className="table-toolbar table-tool-ui"
        role="toolbar"
        aria-label="表格工具"
        style={{ left: point.left, top: point.top }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <button type="button" title="在下方插入行" onClick={() => run("row-below")}>＋ 行</button>
        <button type="button" title="在右侧插入列" onClick={() => run("col-right")}>＋ 列</button>
        <button
          type="button"
          className="table-toolbar-more"
          title="更多表格操作"
          aria-label="更多表格操作"
          aria-expanded={!!menu}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu((old) => old ? null : { x: rect.right - 180, y: rect.bottom + 6 });
          }}
        >
          •••
        </button>
      </div>
      {menu && (
        <div
          className="table-menu table-tool-ui"
          role="menu"
          aria-label="表格操作"
          style={{ left: menuLeft, top: menuTop }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {item("在上方插入行", "row-above")}
          {item("在下方插入行", "row-below")}
          <div className="table-menu-sep" />
          {item("在左侧插入列", "col-left")}
          {item("在右侧插入列", "col-right")}
          <div className="table-menu-sep" />
          {item("删除当前行", "delete-row", true, active.isHeader)}
          {item("删除当前列", "delete-col", true)}
          {item("删除表格", "delete-table", true)}
        </div>
      )}
    </>
  );
}
