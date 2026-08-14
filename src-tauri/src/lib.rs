mod fs_cmds;

use fs_cmds::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_dir_tree,
            read_text_file,
            write_text_file,
            create_entry,
            rename_entry,
            delete_entry,
            path_exists,
            write_binary_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MarkUp application");
}
