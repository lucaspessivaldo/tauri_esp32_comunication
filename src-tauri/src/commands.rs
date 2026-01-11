use crate::serial::{DeviceStatus, PortInfo, SerialState, UploadResult};
use crate::signals::{self, SignalConfig, SignalInfo};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn list_ports() -> Result<Vec<PortInfo>, String> {
    crate::serial::SerialConnection::list_ports().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn connect(port: String, state: State<SerialState>) -> Result<(), String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.connect(&port).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn disconnect(state: State<SerialState>) -> Result<(), String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.disconnect().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn run_signal(state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_command('r').map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_signal(state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_command('s').map_err(|e| e.to_string())
}

#[tauri::command]
pub fn increase_rpm(state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_command('+').map_err(|e| e.to_string())
}

#[tauri::command]
pub fn decrease_rpm(state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_command('-').map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_to_nvs(state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_command('w').map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_defaults(state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_command('d').map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_status(state: State<SerialState>) -> Result<DeviceStatus, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.get_status().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_config(config: String, state: State<'_, SerialState>) -> Result<UploadResult, String> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut connection = state.0.lock().map_err(|e| e.to_string())?;
        connection.send_config(&config).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn is_connected(state: State<SerialState>) -> Result<bool, String> {
    let connection = state.0.lock().map_err(|e| e.to_string())?;
    Ok(connection.is_connected())
}

// ===========================================
// Signal Library Commands
// ===========================================

/// Import a signal config from JSON string and save locally
#[tauri::command]
pub fn import_signal(json: String, app: AppHandle) -> Result<String, String> {
    let config: SignalConfig = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    signals::save_signal(&app, &config)
        .map_err(|e| e.to_string())
}

/// List all saved signals
#[tauri::command]
pub fn list_saved_signals(app: AppHandle) -> Result<Vec<SignalInfo>, String> {
    signals::list_signals(&app)
        .map_err(|e| e.to_string())
}

/// Load a signal by filename
#[tauri::command]
pub fn load_saved_signal(filename: String, app: AppHandle) -> Result<SignalConfig, String> {
    signals::load_signal(&app, &filename)
        .map_err(|e| e.to_string())
}

/// Delete a signal by filename
#[tauri::command]
pub fn delete_saved_signal(filename: String, app: AppHandle) -> Result<(), String> {
    signals::delete_signal(&app, &filename)
        .map_err(|e| e.to_string())
}

/// Load a signal and upload it to ESP32
#[tauri::command]
pub fn upload_saved_signal(filename: String, app: AppHandle, state: State<SerialState>) -> Result<UploadResult, String> {
    // Load the signal
    let config = signals::load_signal(&app, &filename)
        .map_err(|e| e.to_string())?;
    
    // Format for ESP32
    let json = signals::format_for_esp32(&config);
    
    // Debug: print what we're sending
    eprintln!("[UPLOAD] JSON to send ({} bytes):", json.len());
    eprintln!("[UPLOAD] {}", &json[..json.len().min(200)]);
    
    // Send to device
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_config(&json).map_err(|e| e.to_string())
}
