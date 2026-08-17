import { describe, expect, it } from "vitest";
import { DirEntry } from "./fs";
import { filterDirEntry } from "./fileSearch";

const tree: DirEntry = {
  name: "notes",
  path: "/notes",
  is_dir: true,
  children: [
    { name: "README.md", path: "/notes/README.md", is_dir: false, children: [] },
    {
      name: "Projects",
      path: "/notes/Projects",
      is_dir: true,
      children: [
        { name: "Launch Plan.md", path: "/notes/Projects/Launch Plan.md", is_dir: false, children: [] },
        { name: "archive.txt", path: "/notes/Projects/archive.txt", is_dir: false, children: [] },
      ],
    },
  ],
};

describe("filterDirEntry", () => {
  it("matches names case-insensitively and keeps their parent path", () => {
    const result = filterDirEntry(tree, "launch");
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0].children[0].name).toBe("Launch Plan.md");
  });

  it("keeps a complete subtree when the directory itself matches", () => {
    expect(filterDirEntry(tree, "projects")?.children[0].children).toHaveLength(2);
  });

  it("returns null when nothing matches", () => {
    expect(filterDirEntry(tree, "missing")).toBeNull();
  });
});
