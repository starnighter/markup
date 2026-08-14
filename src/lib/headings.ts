export interface DocumentHeading {
  level: number;
  text: string;
  /** 在渲染后 h1~h6 NodeList 中的顺序 */
  index: number;
}

function plainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`+([^`]*)`+/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[\\*_~]/g, "")
    .trim();
}

/** 提取 Markdown 标题，忽略 fenced code block 中伪装成标题的内容。 */
export function extractHeadings(markdown: string): DocumentHeading[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const headings: DocumentHeading[] = [];
  let fenceChar = "";
  let fenceLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }
    if (fenceChar) continue;

    const atx = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (atx) {
      const text = plainText(atx[2].replace(/\s+#+\s*$/, ""));
      if (text) headings.push({ level: atx[1].length, text, index: headings.length });
      continue;
    }

    const underline = lines[i + 1]?.match(/^\s{0,3}(=+|-+)\s*$/);
    if (line.trim() && underline) {
      const text = plainText(line.trim());
      if (text) {
        headings.push({ level: underline[1][0] === "=" ? 1 : 2, text, index: headings.length });
      }
      i++;
    }
  }

  return headings;
}
