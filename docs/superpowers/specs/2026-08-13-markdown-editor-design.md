# MarkUp — 跨平台离线 Markdown 阅读/编辑器 设计文档

日期：2026-08-13
状态：已确认方案 A（Tauri 2 + Web 编辑器内核）

## 1. 目标与范围

做一个类似 Typora / Obsidian 的**纯离线** Markdown 阅读与编辑器，单一代码库发布到
macOS / Windows / Linux / Android / iOS 五个平台。

**功能范围（v1）**

- 文件夹工作区：打开本地文件夹，侧边栏展示文件树；新建/重命名/删除文件与文件夹
- 双模式编辑：Typora 式所见即所得（IR）与纯源码模式（SV），一键切换
- 渲染能力：GFM（表格/任务列表/删除线/自动链接）、代码高亮、KaTeX 数学公式、Mermaid 图表
- 自动保存 + 手动保存（Cmd/Ctrl+S），脏状态提示
- 亮/暗主题
- 全离线：不发起任何网络请求，所有渲染资源（KaTeX/Mermaid/highlight.js 字体与脚本）本地打包

**明确不做（YAGNI）**：多标签页、全文搜索、双链/图谱、插件系统、云同步、导出 PDF/HTML。

## 2. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 编辑器内核 | Vditor 3.x | 开源、内置 IR（所见即所得）/SV（源码）双模式、自带 GFM/highlight/KaTeX/Mermaid，需求一一对应 |
| 前端 | React 18 + TypeScript + Vite 5 | 生态成熟，Tauri 官方模板组合 |
| 状态 | zustand | 轻量，避免 Redux 样板 |
| 外壳 | Tauri 2（Rust） | 单一 Web 代码库发五平台；桌面包 5–15MB；2.x 起官方支持 iOS/Android |
| 文件系统 | Rust 自定义 commands（tauri::command） | 递归目录树在原生侧一次读完，避免前端逐层 IPC |
| 对话框 | tauri-plugin-dialog | 选文件夹/确认删除，移动端可用 |

## 3. 架构

```
┌──────────────────────────── Tauri 窗口 ────────────────────────────┐
│  React 前端 (src/)                                                 │
│  ┌────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │ Sidebar    │  │ EditorView           │  │ StatusBar          │  │
│  │ (FileTree) │  │ (Vditor 封装)        │  │ 字数/保存状态/模式 │  │
│  └─────┬──────┘  └──────────┬───────────┘  └────────────────────┘  │
│        │                    │                                       │
│        └────── zustand store (工作区路径/当前文件/脏状态/主题) ─────┘
│                           │ invoke()                                │
├───────────────────────────┼─────────────────────────────────────────┤
│  Rust 核心 (src-tauri/)   ▼                                         │
│  fs_cmds: read_dir_tree / read_file / write_file /                  │
│           create_entry / rename_entry / delete_entry / path_exists  │
└─────────────────────────────────────────────────────────────────────┘
```

**关键设计决策**

1. **编辑器单例重建**：切换文件时销毁并重建 Vditor 实例（`vditor.destroy()`），
   比 `setValue` 更可靠地避免模式/大纲/缓存串扰。同一文件内的模式切换用
   `Vditor` 原生不支持运行时切换 mode，因此同样通过重建实例实现模式切换
   （重建前取出 `getValue()` 作为初始内容）。
2. **保存策略**：输入后 1s 防抖自动保存 + Cmd/Ctrl+S 立即保存；标题栏显示
   `●` 脏标记。关闭/切文件前若有未保存内容先落盘。
3. **离线资源**：`node_modules/vditor/dist` 在构建期拷贝到 `public/vditor`，
   Vditor 配置 `cdn: './vditor'`，使其从本地加载 highlight.js / KaTeX /
   Mermaid / lute，禁用所有默认 CDN。
4. **Vite `base: './'`**：Tauri 生产环境以自定义协议加载相对路径资源所必需。
5. **文件删除**：v1 直接删除（前端二次确认）。移入回收站留作后续迭代
   （`trash` crate 不支持移动端，需要分平台 cfg，超出一版范围）。
6. **移动端文件访问**：桌面端通过 dialog 选任意文件夹；Android/iOS 受沙盒限制，
   v1 移动端默认工作区为 App 文档目录（`appDocumentDir`），通过系统文件选择器
   打开任意目录（SAF）留作后续迭代。UI 上移动端侧边栏默认折叠，抽屉式展开。

## 4. 模块划分

### Rust（src-tauri/src/lib.rs）

单一模块 `fs_cmds`，全部为 `#[tauri::command]`：

| 命令 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `read_dir_tree` | `root: String` | `DirEntry` | 递归读目录（深度上限 8，跳过 `.` 开头与 `node_modules`），`.md/.markdown` 之外的文件也列出但前端灰显 |
| `read_text_file` | `path` | `String` | 读取 UTF-8 文本（上限 10MB） |
| `write_text_file` | `path, content` | `()` | 原子写：先写 `path.tmp` 再 rename，防断电损坏 |
| `create_entry` | `path, is_dir` | `()` | 新建文件/文件夹（已存在则报错） |
| `rename_entry` | `old, new` | `()` | 重命名/移动 |
| `delete_entry` | `path` | `()` | 递归删除 |
| `path_exists` | `path` | `bool` | 重名检查 |

`DirEntry { name, path, is_dir, children: Vec<DirEntry> }`，serde 序列化。

### 前端（src/）

```
src/
├── main.tsx            # 入口
├── App.tsx             # 布局：Sidebar / EditorView / StatusBar，主题注入
├── store.ts            # zustand：workspace, tree, currentFile, dirty, saving, mode, theme, sidebarOpen
├── lib/
│   ├── fs.ts           # invoke 封装 + 错误统一为 AppError
│   └── vditorAssets.ts # 注册 './vditor' cdn、主题常量
├── components/
│   ├── Sidebar.tsx     # 工作区名 + 操作按钮 + FileTree
│   ├── FileTree.tsx    # 树渲染、展开/折叠、内联重命名、新建、删除确认
│   ├── EditorView.tsx  # Vditor 封装：初始化/重建、防抖保存、快捷键、模式切换
│   ├── TopBar.tsx      # 文件名、脏标记、模式切换、主题切换、侧栏开关
│   ├── StatusBar.tsx   # 字数、保存状态
│   └── Welcome.tsx     # 未打开工作区时的引导页（打开文件夹）
└── styles.css          # CSS 变量主题（亮/暗）+ 布局
```

**数据流**：打开文件夹 → `read_dir_tree` → store.tree → FileTree 渲染；
点击文件 → `read_text_file` → store.currentFile/content → EditorView 重建 Vditor；
输入 → dirty=true → 防抖 1s → `write_text_file` → dirty=false；
文件操作（新建/重命名/删除）→ 对应 command → 重新 `read_dir_tree`。

## 5. 错误处理

- Rust 侧所有 command 返回 `Result<T, String>`，错误信息为可读中文/英文。
- 前端 `fs.ts` 把 invoke 异常包装为 `AppError`，在 TopBar 下方以 toast 条展示，5s 自动消失。
- 读文件失败（编码非 UTF-8/超 10MB/权限）→ 提示并停留原文件。
- 写文件失败 → 保留脏标记，状态栏显示"保存失败"，下个输入周期自动重试。
- 目录树读取失败 → 清空工作区并提示。

## 6. 测试策略

- Rust：`fs_cmds` 纯函数部分（目录树构建、过滤规则、原子写）用 `cargo test`，
  基于 `tempfile` 构造临时目录。
- 前端：`store.ts` 的状态转移（打开工作区/切文件/脏标记/保存完成）用 vitest 单测。
- 手测清单（桌面 dev 运行）：打开文件夹、编辑自动保存、模式切换内容不丢、
  新建/重命名/删除、亮暗切换、重启后工作区记忆（localStorage 记录上次工作区路径）。

## 7. 构建与发布

- 开发：`npm run tauri dev`
- 桌面打包：`npm run tauri build`（macOS 本机出 .app/.dmg；Win/Linux 需对应平台或 CI）
- 移动端：`npm run tauri android init` / `tauri ios init` 生成工程，
  `tauri android build` / `tauri ios build`（需 Android Studio / Xcode）
- CI（后续）：GitHub Actions 矩阵 macOS/Windows/Linux + 移动端正签

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Vditor 默认从 CDN 拉 highlight/KaTeX/Mermaid，离线失效 | 构建期拷贝 dist 到 public，配置本地 cdn；打包后断网手测 |
| Tauri 移动端文件沙盒限制 | v1 移动端用 App 文档目录；SAF 集成列为 v2 |
| Vditor IR 模式在移动 WebView 的键盘体验 | 移动端默认 SV 源码模式起步，工具栏提供格式按钮 |
| 大文档性能 | 单文件 10MB 上限；超出给提示 |
