// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  locateCell,
  insertRow,
  insertCol,
  deleteRow,
  deleteCol,
  deleteTable,
  caretTargetBeforeDelete,
} from "./tableTools";

/** 构造 2 列 ×（表头 + 2 数据行）的表格，与 Vditor IR 渲染结构一致（align 属性存对齐） */
function makeTable(): HTMLTableElement {
  document.body.innerHTML = `
    <table data-block="0" data-type="table">
      <thead><tr><th>a</th><th align="center">b</th></tr></thead>
      <tbody>
        <tr><td>1</td><td align="center">2</td></tr>
        <tr><td>3</td><td align="center">4</td></tr>
      </tbody>
    </table>`;
  return document.querySelector("table")!;
}

const texts = (t: HTMLTableElement) =>
  [...t.querySelectorAll("tr")].map((tr) =>
    [...tr.children].map((c) => c.textContent)
  );

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("locateCell", () => {
  it("定位数据单元格的全表行列索引", () => {
    const t = makeTable();
    const cell = t.querySelectorAll("tbody tr")[1].children[1] as HTMLTableCellElement;
    const pos = locateCell(cell);
    expect(pos.table).toBe(t);
    expect(pos.row).toBe(2); // 表头占第 0 行
    expect(pos.col).toBe(1);
    expect(pos.isHeader).toBe(false);
  });

  it("识别表头单元格", () => {
    const t = makeTable();
    const th = t.querySelector("th")!;
    const pos = locateCell(th);
    expect(pos.row).toBe(0);
    expect(pos.col).toBe(0);
    expect(pos.isHeader).toBe(true);
  });
});

describe("insertRow", () => {
  it("在数据行下方插入等列数的空行", () => {
    const t = makeTable();
    insertRow(t, 1, "below");
    expect(texts(t)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["", ""],
      ["3", "4"],
    ]);
  });

  it("在数据行上方插入", () => {
    const t = makeTable();
    insertRow(t, 2, "above");
    expect(texts(t)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["", ""],
      ["3", "4"],
    ]);
  });

  it("表头行的上方插入转为插入到首个数据行位置", () => {
    const t = makeTable();
    insertRow(t, 0, "above");
    expect(texts(t)).toEqual([
      ["a", "b"],
      ["", ""],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("新行继承各列 align 对齐属性", () => {
    const t = makeTable();
    insertRow(t, 1, "below");
    const cells = t.querySelectorAll("tbody tr")[1].children;
    expect(cells[0].getAttribute("align")).toBeNull();
    expect(cells[1].getAttribute("align")).toBe("center");
  });
});

describe("insertCol", () => {
  it("在右侧插入列：表头为 th、数据行为 td", () => {
    const t = makeTable();
    insertCol(t, 0, "right");
    const [head, body1] = texts(t);
    expect(head).toEqual(["a", "", "b"]);
    expect(body1).toEqual(["1", "", "2"]);
    expect(t.querySelectorAll("thead th").length).toBe(3);
    expect(t.querySelectorAll("tbody td").length).toBe(6);
  });

  it("在左侧插入列", () => {
    const t = makeTable();
    insertCol(t, 1, "left");
    expect(texts(t)[0]).toEqual(["a", "", "b"]);
  });

  it("新列继承同列 align 对齐属性", () => {
    const t = makeTable();
    insertCol(t, 1, "right");
    const headCells = t.querySelector("thead tr")!.children;
    expect(headCells[2].getAttribute("align")).toBe("center");
  });
});

describe("deleteRow", () => {
  it("删除数据行", () => {
    const t = makeTable();
    expect(deleteRow(t, 2)).toBe(true);
    expect(texts(t)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("表头行不可删除", () => {
    const t = makeTable();
    expect(deleteRow(t, 0)).toBe(false);
    expect(texts(t).length).toBe(3);
  });

  it("删除最后一个数据行时删除整个表格", () => {
    const t = makeTable();
    deleteRow(t, 2);
    deleteRow(t, 1);
    expect(document.querySelector("table")).toBeNull();
  });
});

describe("deleteCol", () => {
  it("删除指定列的所有单元格", () => {
    const t = makeTable();
    deleteCol(t, 0);
    expect(texts(t)).toEqual([["b"], ["2"], ["4"]]);
  });

  it("删除最后一列时删除整个表格", () => {
    const t = makeTable();
    deleteCol(t, 0);
    deleteCol(t, 0);
    expect(document.querySelector("table")).toBeNull();
  });
});

describe("deleteTable", () => {
  it("从 DOM 移除表格", () => {
    const t = makeTable();
    deleteTable(t);
    expect(document.querySelector("table")).toBeNull();
  });
});

describe("caretTargetBeforeDelete", () => {
  it("删除行：光标移到上一行同列", () => {
    const t = makeTable();
    const target = caretTargetBeforeDelete(t, 2, 1, "row");
    expect(target).toBe(t.rows[1].cells[1]);
  });

  it("删除首个数据行：光标移到表头同列", () => {
    const t = makeTable();
    const target = caretTargetBeforeDelete(t, 1, 0, "row");
    expect(target).toBe(t.rows[0].cells[0]);
  });

  it("删除最后一个数据行（将整表删除）：光标移到表格外相邻块", () => {
    const t = makeTable();
    deleteRow(t, 2); // 先删到只剩一个数据行
    const after = document.body.appendChild(document.createElement("p"));
    after.textContent = "后";
    const target = caretTargetBeforeDelete(t, 1, 0, "row");
    deleteRow(t, 1);
    expect(target).toBe(after);
  });

  it("删除列：光标移到左邻单元格，首列则移到右邻", () => {
    const t = makeTable();
    expect(caretTargetBeforeDelete(t, 1, 1, "col")).toBe(t.rows[1].cells[0]);
    expect(caretTargetBeforeDelete(t, 1, 0, "col")).toBe(t.rows[1].cells[1]);
  });

  it("删除最后一列（将整表删除）：光标移到表格外", () => {
    const t = makeTable();
    deleteCol(t, 1); // 只剩一列
    document.body.appendChild(document.createElement("p")).textContent = "后";
    const target = caretTargetBeforeDelete(t, 1, 0, "col");
    expect(target?.closest("table")).toBeNull();
  });

  it("删除整表：光标移到表格后（或前）的兄弟块", () => {
    document.body.innerHTML = "";
    const t = makeTable();
    const after = document.body.appendChild(document.createElement("p"));
    expect(caretTargetBeforeDelete(t, 1, 0, "table")).toBe(after);
    after.remove();
    expect(caretTargetBeforeDelete(t, 1, 0, "table")).toBeNull();
  });
});
