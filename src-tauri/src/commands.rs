use crate::serial::{DeviceStatus, PortInfo, SerialState};
use tauri::State;

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
pub fn upload_config(config: String, state: State<SerialState>) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    connection.send_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_connected(state: State<SerialState>) -> Result<bool, String> {
    let connection = state.0.lock().map_err(|e| e.to_string())?;
    Ok(connection.is_connected())
}
