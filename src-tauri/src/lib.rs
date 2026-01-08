mod commands;
mod serial;
pub mod signals;

use commands::*;
use serial::SerialState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SerialState::default())
        .invoke_handler(tauri::generate_handler![
            list_ports,
            connect,
            disconnect,
            run_signal,
            stop_signal,
            increase_rpm,
            decrease_rpm,
            save_to_nvs,
            reset_defaults,
            get_status,
            upload_config,
            is_connected,
            // Signal library commands
            import_signal,
            list_saved_signals,
            load_saved_signal,
            delete_saved_signal,
            upload_saved_signal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
