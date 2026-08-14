import { useEffect, useRef } from "react";
import Vditor from "vditor";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useStore } from "../store";
import { fsApi, joinPath, parentPath } from "../lib/fs";
import { VDITOR_CDN } from "../lib/platform";
import ResizeHandle from "./ResizeHandle";
import TableToolbar from "./TableToolbar";
import DocumentOutline from "./DocumentOutline";
import AIAssistant from "./AIAssistant";

/** "/" 快捷格式菜单（Typora 式）：value 为插入的 Markdown */
const SLASH_ITEMS: { label: string; keys: string; value: string }[] = [
  { label: "H1 标题 1", keys: "h1 bt1 title biaoti heading", value: "# " },
  { label: "H2 标题 2", keys: "h2 bt2 title biaoti heading", value: "## " },
  { label: "H3 标题 3", keys: "h3 bt3 title biaoti heading", value: "### " },
  { label: "H4 标题 4", keys: "h4 bt4 title biaoti heading", value: "#### " },
  { label: "H5 标题 5", keys: "h5 bt5 title biaoti heading", value: "##### " },
  { label: "H6 标题 6", keys: "h6 bt6 title biaoti heading", value: "###### " },
  { label: "代码块", keys: "code daima kuai pre dm", value: "```\n\n```\n" },
  { label: "行内代码", keys: "inline code daima hangnei", value: "`代码`" },
  { label: "引用", keys: "quote yinyong blockquote yy", value: "> " },
  { label: "无序列表", keys: "ul list wuxu liebiao lb", value: "- " },
  { label: "有序列表", keys: "ol list youxu liebiao lb", value: "1. " },
  { label: "任务列表", keys: "todo task renwu liebiao check lb", value: "- [ ] " },
  {
    label: "表格",
    keys: "table biaoge bg",
    value: "\n| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |\n",
  },
  { label: "数学公式块", keys: "math katex gongshi shuxue gs", value: "\n$$\n\n$$\n" },
  { label: "行内公式", keys: "math katex gongshi shuxue inline gs", value: "$E=mc^2$" },
  {
    label: "Mermaid 图表",
    keys: "mermaid tubiao chart flow tb",
    value: "```mermaid\ngraph TD;\n  A --> B;\n```\n",
  },
  { label: "分割线", keys: "hr fengexian line fgx", value: "\n---\n" },
  { label: "目录", keys: "toc mulu outline ml", value: "[toc]\n" },
  { label: "链接", keys: "link lianjie url lj", value: "[链接文字](https://)" },
  { label: "图片", keys: "img image tupian tp", value: "![图片描述](图片地址)" },
  { label: "加粗", keys: "bold jiacu strong jc", value: "**粗体**" },
  { label: "斜体", keys: "italic xieti em xt", value: "*斜体*" },
  { label: "删除线", keys: "strike shanchuxian del scx", value: "~~删除线~~" },
  { label: "高亮", keys: "mark highlight gaoliang gl", value: "==高亮==" },
  { label: "脚注", keys: "footnote zhujie zj", value: "[^1]\n\n[^1]: 脚注内容\n" },
];

function slashHint(key: string) {
  const k = key.trim().toLowerCase();
  return SLASH_ITEMS.filter(
    (it) => !k || it.label.toLowerCase().includes(k) || it.keys.includes(k)
  ).map((it) => ({
    value: it.value,
    html: `<span class="slash-item">${it.label}</span>`,
  }));
}

/** 把预览 HTML 中的相对路径图片转为 Tauri asset 协议 URL，使本地图片可显示 */
function transformImages(html: string, fileDir: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src")!;
    if (/^(https?:|data:|asset:|tauri:)/i.test(src) || src.startsWith("/")) return;
    img.setAttribute("src", convertFileSrc(joinPath(fileDir, decodeURIComponent(src))));
  });
  return doc.body.innerHTML;
}

export default function EditorView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const { currentFile, mode, theme, svRatio, rightPanelVisible, setSvRatio } = useStore();

  /** 把 svRatio / 预览窗格可见性应用到 Vditor SV 模式的 DOM 上 */
  const applySvLayout = () => {
    const host = containerRef.current;
    if (!host) return;
    const sv = host.querySelector(".vditor-sv") as HTMLElement | null;
    const pv = host.querySelector(".vditor-preview") as HTMLElement | null;
    if (!sv || !pv) return;
    const visible = useStore.getState().rightPanelVisible;
    const ratio = useStore.getState().svRatio;
    if (visible) {
      sv.style.flex = `0 0 ${ratio * 100}%`;
      sv.style.maxWidth = `${ratio * 100}%`;
      pv.style.display = "";
    } else {
      sv.style.flex = "1 1 100%";
      sv.style.maxWidth = "100%";
      pv.style.display = "none";
    }
  };

  // 创建/重建编辑器：切换文件或切换模式时
  useEffect(() => {
    if (!currentFile || !containerRef.current) return;
    const initial = useStore.getState().content;
    const isDark = useStore.getState().theme === "dark";
    const fileDir = parentPath(currentFile);

    const scheduleSave = () => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => useStore.getState().saveNow(), 1000);
    };

    /** 粘贴/拖入图片 → 存到当前文件旁的 assets/ 并插入相对链接 */
    const handleUpload = async (files: File[]): Promise<string | null> => {
      const store = useStore.getState();
      try {
        for (const f of files) {
          const safeName = f.name.replace(/[\\/:*?"<>|]/g, "_") || `image-${Date.now()}.png`;
          let relPath = `assets/${safeName}`;
          let n = 1;
          while (await fsApi.pathExists(joinPath(fileDir, relPath))) {
            relPath = `assets/${safeName.replace(/(\.[^.]*)?$/, `-${n++}$1`)}`;
          }
          await fsApi.writeBinaryFile(
            joinPath(fileDir, relPath),
            new Uint8Array(await f.arrayBuffer())
          );
          vditorRef.current?.insertValue(`![${safeName}](${encodeURI(relPath)})\n`);
          store.refreshTree();
        }
        return null; // 自行插入，返回 null 告诉 Vditor 不做默认处理
      } catch (e) {
        return "图片保存失败：" + (e as Error).message;
      }
    };

    const options = {
      height: "100%",
      width: "100%",
      mode,
      lang: "zh_CN" as const,
      cdn: VDITOR_CDN,
      theme: (isDark ? "dark" : "classic") as "dark" | "classic",
      value: initial,
      placeholder: "开始输入 Markdown…",
      cache: { enable: false },
      typewriterMode: false,
      counter: { enable: false },
      outline: { enable: false },
      hint: {
        parse: true,
        delay: 120,
        extend: [{ key: "/", hint: slashHint }],
      },
      toolbar: [
        "headings", "bold", "italic", "strike", "|",
        "list", "ordered-list", "check", "quote", "|",
        "code", "inline-code", "link", "table", "upload", "|",
        "undo", "redo", "|", "fullscreen",
      ],
      toolbarConfig: { pin: true },
      preview: {
        mode: (mode === "sv" ? "both" : "editor") as "both" | "editor",
        markdown: {
          toc: true,
          mark: true,
          footnotes: true,
          autoSpace: true,
          chinesePunct: true,
          fixTermTypo: true,
        },
        math: { engine: "KaTeX" as const, inlineDigit: true },
        hljs: {
          style: isDark ? "github-dark" : "github",
          lineNumber: false,
        },
        theme: {
          current: isDark ? "dark" : "light",
          path: `${VDITOR_CDN}/dist/css/content-theme`,
        },
        // Vditor 类型定义里可能没有 transform，运行时存在；用于本地图片解析
        transform: (html: string) => transformImages(html, fileDir),
      } as never,
      upload: {
        max: 10 * 1024 * 1024,
        accept: "image/*",
        handler: handleUpload,
      },
      input: (value: string) => {
        useStore.getState().setContent(value);
        scheduleSave();
      },
      after: () => {
        vditorRef.current?.setValue(initial);
        if (initial) vditorRef.current?.focus();
        applySvLayout();
      },
      blur: () => {
        window.clearTimeout(saveTimer.current);
        useStore.getState().saveNow();
      },
    };

    // Vditor 的初始化会异步加载 i18n/Lute。开发模式下 StrictMode 会先执行一次
    // effect setup→cleanup；延后一拍创建可避免已清理的旧实例继续绑定 DOM 监听器。
    let vd: Vditor | null = null;
    let disposed = false;
    const initTimer = window.setTimeout(() => {
      if (disposed || !containerRef.current) return;
      vd = new Vditor(
        containerRef.current,
        options as unknown as ConstructorParameters<typeof Vditor>[1]
      );
      vditorRef.current = vd;
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(initTimer);
      window.clearTimeout(saveTimer.current);
      // 重建前把最后一击同步进 store（正常情况下 input 已同步）
      if (vd) {
        try {
          const v = vd.getValue();
          if (v !== useStore.getState().content) useStore.getState().setContent(v);
          vd.destroy();
        } catch {
          /* 编辑器未初始化完成时 destroy 可能抛错 */
        }
      }
      if (vditorRef.current === vd) vditorRef.current = null;
    };
    // theme 通过 setTheme 单独同步，不触发重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile, mode]);

  // 主题切换 → 同步 Vditor 主题
  useEffect(() => {
    const isDark = theme === "dark";
    try {
      vditorRef.current?.setTheme(
        isDark ? "dark" : "classic",
        isDark ? "dark" : "light",
        isDark ? "github-dark" : "github",
        `${VDITOR_CDN}/dist/css/content-theme`
      );
    } catch {
      /* 实例未就绪时忽略，下次重建会用新主题 */
    }
  }, [theme]);

  // 源码模式分栏比例/预览窗格可见性变化 → 应用到 DOM
  useEffect(() => {
    if (mode === "sv") applySvLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svRatio, rightPanelVisible, mode, currentFile]);

  // 卸载/切文件前兜底保存
  useEffect(() => {
    const flush = () => useStore.getState().saveNow();
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.clearTimeout(saveTimer.current);
      flush();
    };
  }, [currentFile]);

  if (!currentFile) return null;
  return (
    <div className="editor-wrap" ref={wrapRef}>
      <div className="editor-host" ref={containerRef} />
      {mode === "ir" && <TableToolbar hostRef={containerRef} />}
      <AIAssistant editorRef={containerRef} vditorRef={vditorRef} />
      {mode === "ir" && rightPanelVisible && <DocumentOutline editorRef={containerRef} />}
      {mode === "sv" && rightPanelVisible && (
        <ResizeHandle
          className="sv-handle"
          style={{ left: `calc(${svRatio * 100}% - 3px)` }}
          onDrag={(x) => {
            const rect = wrapRef.current?.getBoundingClientRect();
            if (rect && rect.width > 0) setSvRatio((x - rect.left) / rect.width);
          }}
          onDoubleClick={() => setSvRatio(0.5)}
        />
      )}
    </div>
  );
}
