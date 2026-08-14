import { describe, expect, it } from "vitest";
import { DirEntry } from "./fs";
import { searchMarkdownFiles } from "./quickOpen";

const tree: DirEntry = {
  name: "Writing",
  path: "/workspace/Writing",
  is_dir: true,
  children: [
    { name: "README.md", path: "/workspace/Writing/README.md", is_dir: false, children: [] },
    { name: "cover.png", path: "/workspace/Writing/cover.png", is_dir: false, children: [] },
    {
      name: "Projects",
      path: "/workspace/Writing/Projects",
      is_dir: true,
      children: [
        { name: "Launch Plan.md", path: "/workspace/Writing/Projects/Launch Plan.md", is_dir: false, children: [] },
        { name: "Launch Notes.md", path: "/workspace/Writing/Projects/Launch Notes.md", is_dir: false, children: [] },
      ],
    },
  ],
};

describe("searchMarkdownFiles", () => {
  it("只返回 Markdown 文档并生成工作区相对路径", () => {
    const result = searchMarkdownFiles(tree, "/workspace/Writing", "");
    expect(result.map((item) => item.relativePath)).toEqual([
      "Projects/Launch Notes.md",
      "Projects/Launch Plan.md",
      "README.md",
    ]);
    expect(result[0].parent).toBe("Projects");
  });

  it("精确文件名优先于普通路径命中", () => {
    const result = searchMarkdownFiles(tree, "/workspace/Writing", "readme");
    expect(result[0].name).toBe("README.md");
    expect(result[0].score).toBe(0);
  });

  it("支持非连续字符的模糊匹配", () => {
    const result = searchMarkdownFiles(tree, "/workspace/Writing", "lpn");
    expect(result.map((item) => item.name)).toContain("Launch Plan.md");
  });

  it("无匹配时返回空数组并遵守结果数量限制", () => {
    expect(searchMarkdownFiles(tree, "/workspace/Writing", "missing")).toEqual([]);
    expect(searchMarkdownFiles(tree, "/workspace/Writing", "launch", 1)).toHaveLength(1);
  });
});
