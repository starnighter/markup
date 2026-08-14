import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: DirEntry[];
}

export class AppError extends Error {}

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new AppError(typeof e === "string" ? e : (e as Error).message ?? String(e));
  }
}

export const fsApi = {
  readDirTree: (root: string) => call<DirEntry>("read_dir_tree", { root }),
  readTextFile: (path: string) => call<string>("read_text_file", { path }),
  writeTextFile: (path: string, content: string) =>
    call<void>("write_text_file", { path, content }),
  createEntry: (path: string, isDir: boolean) =>
    call<void>("create_entry", { path, isDir }),
  renameEntry: (oldPath: string, newPath: string) =>
    call<void>("rename_entry", { old: oldPath, new: newPath }),
  deleteEntry: (path: string) => call<void>("delete_entry", { path }),
  pathExists: (path: string) => call<boolean>("path_exists", { path }),
  writeBinaryFile: (path: string, bytes: Uint8Array) =>
    call<void>("write_binary_file", { path, bytes: Array.from(bytes) }),
};

/** 拼接路径（统一用 /，Rust 侧 Windows 也能识别） */
export function joinPath(parent: string, name: string): string {
  return parent.replace(/[\\/]+$/, "") + "/" + name;
}

export function parentPath(p: string): string {
  const idx = p.replace(/[\\/]+$/, "").search(/[\\/][^\\/]*$/);
  return idx > 0 ? p.slice(0, idx) : p;
}

export function isMarkdown(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}
