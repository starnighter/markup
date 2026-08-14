/**
 * 表格行列编辑（Obsidian 式）：直接操作 Vditor IR 渲染出的真实 <table> DOM，
 * 变更后由调用方派发 input 事件，走 Vditor 自身的 DOM→Markdown 转换管道。
 */

export interface CellPos {
  table: HTMLTableElement;
  /** 全表行索引（表头为 0，数据行从 1 开始） */
  row: number;
  col: number;
  isHeader: boolean;
}

/** 从单元格定位其在表格中的位置 */
export function locateCell(cell: HTMLTableCellElement): CellPos {
  const tr = cell.parentElement as HTMLTableRowElement;
  const table = cell.closest("table") as HTMLTableElement;
  return {
    table,
    row: tr.rowIndex,
    col: cell.cellIndex,
    isHeader: !!cell.closest("thead"),
  };
}

/** 新建空单元格，继承参考单元格的 align 对齐属性（Vditor/Lute 的约定） */
function makeCell(tag: "th" | "td", ref: Element | undefined): HTMLTableCellElement {
  const cell = document.createElement(tag);
  const align = ref?.getAttribute("align");
  if (align) cell.setAttribute("align", align);
  return cell;
}

/** 表格列数（以单元格最多的行为准） */
function colCount(table: HTMLTableElement): number {
  let n = 0;
  for (const tr of Array.from(table.rows)) n = Math.max(n, tr.cells.length);
  return n;
}

/**
 * 在参考行（全表索引）的上/下方插入空行。
 * 表头行的 "above" 转为插入到首个数据行位置（表头永远保持第一行）。
 */
export function insertRow(
  table: HTMLTableElement,
  refRow: number,
  where: "above" | "below"
): void {
  const rows = Array.from(table.rows);
  const ref = rows[refRow];
  if (!ref) return;
  const isHeaderRow = !!ref.closest("thead");
  // 目标插入位置（全表索引）：表头行一律插到数据区顶部
  const at = isHeaderRow ? 1 : where === "above" ? refRow : refRow + 1;
  const cols = colCount(table);
  const tr = document.createElement("tr");
  for (let c = 0; c < cols; c++) {
    tr.appendChild(makeCell("td", ref.cells[c] ?? rows[1]?.cells[c]));
  }
  const anchor = rows[at];
  if (anchor) {
    anchor.parentElement!.insertBefore(tr, anchor);
  } else {
    (table.tBodies[0] ?? table.createTBody()).appendChild(tr);
  }
}

/** 在参考列的左/右侧插入空列；表头用 th，数据行用 td，继承同列对齐 */
export function insertCol(
  table: HTMLTableElement,
  refCol: number,
  where: "left" | "right"
): void {
  const at = where === "left" ? refCol : refCol + 1;
  for (const tr of Array.from(table.rows)) {
    const isHead = !!tr.closest("thead");
    const ref = tr.cells[Math.min(refCol, tr.cells.length - 1)];
    const cell = makeCell(isHead ? "th" : "td", ref);
    const anchor = tr.cells[at];
    if (anchor) tr.insertBefore(cell, anchor);
    else tr.appendChild(cell);
  }
}

/**
 * 删除行（全表索引）。表头行不可删除，返回 false；
 * 删除最后一个数据行时整张表无意义，直接删除表格。
 */
export function deleteRow(table: HTMLTableElement, row: number): boolean {
  const tr = table.rows[row];
  if (!tr || tr.closest("thead")) return false;
  const bodyRows = table.tBodies[0]?.rows.length ?? 0;
  if (bodyRows <= 1) {
    deleteTable(table);
    return true;
  }
  tr.remove();
  return true;
}

/** 删除列；删除最后一列时直接删除表格 */
export function deleteCol(table: HTMLTableElement, col: number): void {
  if (colCount(table) <= 1) {
    deleteTable(table);
    return;
  }
  for (const tr of Array.from(table.rows)) tr.cells[col]?.remove();
}

/** 删除整个表格 */
export function deleteTable(table: HTMLTableElement): void {
  table.remove();
}

/**
 * 在删除前找一个仍会留在文档中的光标落点。
 *
 * Vditor 会从当前 selection 所在的 contenteditable 重新序列化 Markdown；
 * 若 selection 还留在即将移除的节点中，删除行/列后可能得到旧值。因此调用方应
 * 先取得本函数的返回值并移动光标，再执行删除。
 */
export function caretTargetBeforeDelete(
  table: HTMLTableElement,
  row: number,
  col: number,
  what: "row" | "col" | "table"
): HTMLElement | null {
  const outsideTable = () =>
    (table.nextElementSibling ?? table.previousElementSibling) as HTMLElement | null;

  if (what === "table") return outsideTable();

  if (what === "row") {
    const bodyRows = table.tBodies[0]?.rows.length ?? 0;
    if (bodyRows <= 1) return outsideTable();

    const targetRow = table.rows[row - 1] ?? table.rows[row + 1];
    if (!targetRow) return outsideTable();
    return (targetRow.cells[Math.min(col, targetRow.cells.length - 1)] as HTMLElement) ?? null;
  }

  if (colCount(table) <= 1) return outsideTable();
  const targetRow = table.rows[row] ?? table.rows[0];
  if (!targetRow) return outsideTable();
  return (targetRow.cells[col - 1] ?? targetRow.cells[col + 1] ?? null) as HTMLElement | null;
}
