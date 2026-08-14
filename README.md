# MarkUp

MarkUp 是一个简洁、离线优先的 Markdown 编辑器，基于 Tauri、React 和 Vditor 构建。

支持所见即所得编辑、源码与实时预览、文档大纲、GFM 表格、代码高亮、数学公式、Mermaid、文件树搜索、最近工作区、自动保存和明暗主题。可选的 AI 写作助手内置常用服务预设，也支持自定义 Base URL、模型和 API 格式；AI 配置保存在本机应用存储中。

## 启动

需要 Node.js、Rust 和 Tauri 2 的系统依赖。

```bash
npm install
npm run tauri dev
```

仅启动前端开发服务器：

```bash
npm run dev
```

浏览器模式下本地文件系统功能不可用。

## 测试与构建

```bash
npm test
npm run tauri build
```

## License

[MIT](LICENSE)
