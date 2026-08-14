import { describe, expect, it } from "vitest";
import { extractHeadings } from "./headings";

describe("extractHeadings", () => {
  it("提取 ATX 与 Setext 标题并保留层级", () => {
    expect(extractHeadings("# 一级\n\n## 二级 **加粗** ##\n\n三级\n---"))
      .toEqual([
        { level: 1, text: "一级", index: 0 },
        { level: 2, text: "二级 加粗", index: 1 },
        { level: 2, text: "三级", index: 2 },
      ]);
  });

  it("忽略代码围栏里的伪标题", () => {
    expect(extractHeadings("# 正文\n```md\n# 代码\n```\n### 结尾").map((h) => h.text))
      .toEqual(["正文", "结尾"]);
  });

  it("清理链接、图片和行内代码标记", () => {
    expect(extractHeadings("## [链接](https://example.com) 与 `代码` ![图](a.png)")[0].text)
      .toBe("链接 与 代码 图");
  });
});
