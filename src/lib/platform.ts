/** 粗略判断移动端（决定默认编辑模式与抽屉式侧栏） */
export const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** 跨平台快捷键提示（macOS 使用 Command，其余平台使用 Ctrl）。 */
export const primaryModifier = /Mac|iPhone|iPad|iPod/i.test(
  navigator.platform || navigator.userAgent,
) ? "⌘" : "Ctrl";

export const VDITOR_CDN = "./vditor";
