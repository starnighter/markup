//! 文件系统命令：目录树读取、文本读写、新建/重命名/删除。
//! 所有函数可独立单元测试（不依赖 Tauri 运行时），Tauri command 只是薄封装。

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// 单文件大小上限：10 MB
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
/// 目录树递归深度上限
const MAX_DEPTH: usize = 8;
/// 目录树条目总数上限（防误开超大目录卡死 UI）
const MAX_ENTRIES: usize = 20_000;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<DirEntry>,
}

fn is_skipped(name: &str) -> bool {
    name.starts_with('.') || name == "node_modules" || name == "target"
}

fn build_tree(dir: &Path, depth: usize, budget: &mut usize) -> Result<Vec<DirEntry>, String> {
    if depth > MAX_DEPTH {
        return Ok(vec![]);
    }
    let mut entries: Vec<DirEntry> = Vec::new();
    let read = fs::read_dir(dir).map_err(|e| format!("无法读取目录 {}: {e}", dir.display()))?;
    for item in read {
        let item = item.map_err(|e| format!("读取目录项失败: {e}"))?;
        let name = item.file_name().to_string_lossy().to_string();
        if is_skipped(&name) {
            continue;
        }
        if *budget == 0 {
            return Err(format!("目录条目超过 {MAX_ENTRIES}，已截断（目录过大）"));
        }
        *budget -= 1;
        let path = item.path();
        let is_dir = path.is_dir();
        let children = if is_dir {
            build_tree(&path, depth + 1, budget)?
        } else {
            vec![]
        };
        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }
    // 目录在前，名称本地化排序
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn read_dir_tree_impl(root: &str) -> Result<DirEntry, String> {
    let root_path = PathBuf::from(root);
    if !root_path.is_dir() {
        return Err(format!("不是有效目录: {root}"));
    }
    let mut budget = MAX_ENTRIES;
    let children = build_tree(&root_path, 0, &mut budget)?;
    Ok(DirEntry {
        name: root_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| root.to_string()),
        path: root.to_string(),
        is_dir: true,
        children,
    })
}

pub fn read_text_file_impl(path: &str) -> Result<String, String> {
    let p = PathBuf::from(path);
    let meta = fs::metadata(&p).map_err(|e| format!("无法访问文件: {e}"))?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(format!(
            "文件过大（{} MB），超过 10 MB 上限",
            meta.len() / 1024 / 1024
        ));
    }
    fs::read_to_string(&p).map_err(|e| format!("读取文件失败（需 UTF-8 文本）: {e}"))
}

/// 原子写：先写同名 .tmp 再 rename，避免写入中断损坏原文件
pub fn write_text_file_impl(path: &str, content: &str) -> Result<(), String> {
    let p = PathBuf::from(path);
    let tmp = p.with_extension("markup-tmp");
    fs::write(&tmp, content).map_err(|e| format!("写入临时文件失败: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("保存失败: {e}"))
}

pub fn create_entry_impl(path: &str, is_dir: bool) -> Result<(), String> {
    let p = PathBuf::from(path);
    if p.exists() {
        return Err(format!("已存在: {path}"));
    }
    if is_dir {
        fs::create_dir_all(&p).map_err(|e| format!("创建文件夹失败: {e}"))
    } else {
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {e}"))?;
        }
        fs::write(&p, "").map_err(|e| format!("创建文件失败: {e}"))
    }
}

pub fn rename_entry_impl(old: &str, new: &str) -> Result<(), String> {
    if Path::new(new).exists() {
        return Err(format!("目标已存在: {new}"));
    }
    fs::rename(old, new).map_err(|e| format!("重命名失败: {e}"))
}

pub fn delete_entry_impl(path: &str) -> Result<(), String> {
    let p = PathBuf::from(path);
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| format!("删除文件夹失败: {e}"))
    } else {
        fs::remove_file(&p).map_err(|e| format!("删除文件失败: {e}"))
    }
}

// ---------- Tauri commands（薄封装） ----------

#[tauri::command]
pub fn read_dir_tree(root: String) -> Result<DirEntry, String> {
    read_dir_tree_impl(&root)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    read_text_file_impl(&path)
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    write_text_file_impl(&path, &content)
}

#[tauri::command]
pub fn create_entry(path: String, is_dir: bool) -> Result<(), String> {
    create_entry_impl(&path, is_dir)
}

#[tauri::command]
pub fn rename_entry(old: String, new: String) -> Result<(), String> {
    rename_entry_impl(&old, &new)
}

#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    delete_entry_impl(&path)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// 写二进制文件（粘贴图片落盘用），自动创建父目录
#[tauri::command]
pub fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("文件过大，超过 10 MB 上限".to_string());
    }
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    fs::write(&p, bytes).map_err(|e| format!("写入文件失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    fn setup() -> tempfile::TempDir {
        let t = tempfile::tempdir().unwrap();
        let r = t.path();
        stdfs::create_dir_all(r.join("docs/sub")).unwrap();
        stdfs::write(r.join("a.md"), "# A").unwrap();
        stdfs::write(r.join("docs/b.md"), "# B").unwrap();
        stdfs::write(r.join("docs/sub/c.txt"), "plain").unwrap();
        stdfs::write(r.join(".hidden"), "x").unwrap();
        stdfs::create_dir_all(r.join("node_modules/pkg")).unwrap();
        t
    }

    #[test]
    fn tree_filters_hidden_and_sorts_dirs_first() {
        let t = setup();
        let tree = read_dir_tree_impl(t.path().to_str().unwrap()).unwrap();
        assert!(tree.is_dir);
        let names: Vec<&str> = tree.children.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["docs", "a.md"]); // docs 目录在前；.hidden/node_modules 被过滤
        let doc_names: Vec<&str> = tree.children[0]
            .children
            .iter()
            .map(|e| e.name.as_str())
            .collect();
        assert_eq!(doc_names, vec!["sub", "b.md"]);
    }

    #[test]
    fn read_write_roundtrip_and_atomic_tmp_removed() {
        let t = setup();
        let p = t.path().join("note.md");
        write_text_file_impl(p.to_str().unwrap(), "你好 **markdown**").unwrap();
        assert_eq!(
            read_text_file_impl(p.to_str().unwrap()).unwrap(),
            "你好 **markdown**"
        );
        assert!(!t.path().join("note.markup-tmp").exists());
    }

    #[test]
    fn rejects_oversize_file() {
        let t = setup();
        let p = t.path().join("big.md");
        stdfs::write(&p, vec![b'x'; (MAX_FILE_BYTES + 1) as usize]).unwrap();
        assert!(read_text_file_impl(p.to_str().unwrap())
            .unwrap_err()
            .contains("过大"));
    }

    #[test]
    fn create_rename_delete() {
        let t = setup();
        let dir = t.path();
        let f = dir.join("new.md");
        create_entry_impl(f.to_str().unwrap(), false).unwrap();
        assert!(f.exists());
        assert!(create_entry_impl(f.to_str().unwrap(), false).is_err());

        let f2 = dir.join("renamed.md");
        rename_entry_impl(f.to_str().unwrap(), f2.to_str().unwrap()).unwrap();
        assert!(!f.exists() && f2.exists());
        assert!(rename_entry_impl(f2.to_str().unwrap(), dir.join("a.md").to_str().unwrap()).is_err());

        let d = dir.join("folder");
        create_entry_impl(d.to_str().unwrap(), true).unwrap();
        stdfs::write(d.join("x.md"), "x").unwrap();
        delete_entry_impl(d.to_str().unwrap()).unwrap();
        assert!(!d.exists());
    }

    #[test]
    fn invalid_root_errors() {
        assert!(read_dir_tree_impl("/nonexistent/path/xyz").is_err());
    }
}
