// 构建/启动前把 Vditor 的运行时资源（highlight.js / KaTeX / Mermaid / 主题 css）
// 拷贝到 public/vditor，使 Vditor 的 cdn 选项指向本地，实现完全离线。
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "vditor", "dist");
const dest = join(root, "public", "vditor", "dist");

if (!existsSync(src)) {
  console.warn("[copy-vditor] node_modules/vditor/dist 不存在，跳过（先 npm install）");
  process.exit(0);
}
rmSync(join(root, "public", "vditor"), { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-vditor] 已拷贝 vditor/dist -> public/vditor/dist");
