import { DirEntry } from "./fs";

/** 递归过滤目录树；目录命中时保留完整子树，子项命中时只保留匹配路径。 */
export function filterDirEntry(entry: DirEntry, query: string): DirEntry | null {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return entry;

  const ownMatch = entry.name.toLocaleLowerCase().includes(keyword);
  if (!entry.is_dir) return ownMatch ? entry : null;
  if (ownMatch) return entry;

  const children = entry.children
    .map((child) => filterDirEntry(child, keyword))
    .filter((child): child is DirEntry => child !== null);
  return children.length ? { ...entry, children } : null;
}
