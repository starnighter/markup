import { DirEntry, isMarkdown } from "./fs";

export interface QuickOpenItem {
  name: string;
  path: string;
  relativePath: string;
  parent: string;
  score: number;
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\\/g, "/");
}

function fuzzyScore(value: string, query: string): number | null {
  let queryIndex = 0;
  let first = -1;
  let previous = -1;
  let gaps = 0;
  for (let index = 0; index < value.length && queryIndex < query.length; index++) {
    if (value[index] !== query[queryIndex]) continue;
    if (first < 0) first = index;
    if (previous >= 0) gaps += index - previous - 1;
    previous = index;
    queryIndex++;
  }
  if (queryIndex !== query.length) return null;
  return first + gaps + (value.length - query.length) * 0.01;
}

function collectMarkdown(entry: DirEntry, workspace: string, result: QuickOpenItem[]) {
  if (!entry.is_dir) {
    if (!isMarkdown(entry.name)) return;
    const normalizedWorkspace = workspace.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedPath = entry.path.replace(/\\/g, "/");
    const relativePath = normalizedPath.startsWith(normalizedWorkspace + "/")
      ? normalizedPath.slice(normalizedWorkspace.length + 1)
      : entry.name;
    const separator = relativePath.lastIndexOf("/");
    result.push({
      name: entry.name,
      path: entry.path,
      relativePath,
      parent: separator >= 0 ? relativePath.slice(0, separator) : "工作区根目录",
      score: 0,
    });
    return;
  }
  entry.children.forEach((child) => collectMarkdown(child, workspace, result));
}

/** 扁平化工作区中的 Markdown 文档，并按文件名、路径与模糊匹配质量排序。 */
export function searchMarkdownFiles(tree: DirEntry, workspace: string, query: string, limit = 40): QuickOpenItem[] {
  const items: QuickOpenItem[] = [];
  collectMarkdown(tree, workspace, items);
  const keyword = normalize(query.trim());
  if (!keyword) {
    return items
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: "base" }))
      .slice(0, limit);
  }

  return items
    .map((item) => {
      const name = normalize(item.name);
      const stem = name.replace(/\.md$/i, "");
      const path = normalize(item.relativePath);
      let score: number | null = null;
      if (stem === keyword || name === keyword) score = 0;
      else if (stem.startsWith(keyword)) score = 10 + stem.length * 0.01;
      else if (name.includes(keyword)) score = 20 + name.indexOf(keyword);
      else if (path.includes(keyword)) score = 30 + path.indexOf(keyword);
      else {
        const nameFuzzy = fuzzyScore(name, keyword);
        const pathFuzzy = fuzzyScore(path, keyword);
        if (nameFuzzy !== null) score = 40 + nameFuzzy;
        else if (pathFuzzy !== null) score = 60 + pathFuzzy;
      }
      return score === null ? null : { ...item, score };
    })
    .filter((item): item is QuickOpenItem => item !== null)
    .sort((a, b) => a.score - b.score || a.relativePath.localeCompare(b.relativePath))
    .slice(0, limit);
}
