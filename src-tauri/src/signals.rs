use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Signal configuration from Signal Generator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalConfig {
    pub name: String,
    #[serde(rename = "CKP")]
    pub ckp: String,
    #[serde(rename = "CMP1")]
    pub cmp1: Option<String>,
    #[serde(rename = "CMP2")]
    pub cmp2: Option<String>,
}

/// Signal info for listing (without full blob data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalInfo {
    pub name: String,
    pub filename: String,
    pub has_ckp: bool,
    pub has_cmp1: bool,
    pub has_cmp2: bool,
}

#[derive(Debug)]
pub enum SignalError {
    IoError(String),
    ParseError(String),
    ValidationError(String),
    NotFound(String),
}

impl std::fmt::Display for SignalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SignalError::IoError(msg) => write!(f, "IO Error: {}", msg),
            SignalError::ParseError(msg) => write!(f, "Parse Error: {}", msg),
            SignalError::ValidationError(msg) => write!(f, "Validation Error: {}", msg),
            SignalError::NotFound(msg) => write!(f, "Not Found: {}", msg),
        }
    }
}

impl From<std::io::Error> for SignalError {
    fn from(err: std::io::Error) -> Self {
        SignalError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for SignalError {
    fn from(err: serde_json::Error) -> Self {
        SignalError::ParseError(err.to_string())
    }
}

/// Get the signals directory path
pub fn get_signals_dir(app: &AppHandle) -> Result<PathBuf, SignalError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| SignalError::IoError(e.to_string()))?;
    
    let signals_dir = app_data_dir.join("signals");
    
    // Create directory if it doesn't exist
    if !signals_dir.exists() {
        fs::create_dir_all(&signals_dir)?;
    }
    
    Ok(signals_dir)
}

/// Validate signal config
pub fn validate_signal(config: &SignalConfig) -> Result<(), SignalError> {
    if config.name.is_empty() {
        return Err(SignalError::ValidationError("Signal name cannot be empty".into()));
    }
    
    if !config.ckp.starts_with("SIG1") {
        return Err(SignalError::ValidationError("CKP must start with SIG1 prefix".into()));
    }
    
    if let Some(ref cmp1) = config.cmp1 {
        if !cmp1.starts_with("SIG1") {
            return Err(SignalError::ValidationError("CMP1 must start with SIG1 prefix".into()));
        }
    }
    
    if let Some(ref cmp2) = config.cmp2 {
        if !cmp2.starts_with("SIG1") {
            return Err(SignalError::ValidationError("CMP2 must start with SIG1 prefix".into()));
        }
    }
    
    Ok(())
}

/// Generate safe filename from signal name
fn safe_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .to_lowercase()
}

/// Save a signal configuration
pub fn save_signal(app: &AppHandle, config: &SignalConfig) -> Result<String, SignalError> {
    validate_signal(config)?;
    
    let signals_dir = get_signals_dir(app)?;
    let filename = format!("{}.json", safe_filename(&config.name));
    let filepath = signals_dir.join(&filename);
    
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&filepath, json)?;
    
    Ok(filename)
}

/// List all saved signals
pub fn list_signals(app: &AppHandle) -> Result<Vec<SignalInfo>, SignalError> {
    let signals_dir = get_signals_dir(app)?;
    let mut signals = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&signals_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(config) = serde_json::from_str::<SignalConfig>(&content) {
                        let filename = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        
                        signals.push(SignalInfo {
                            name: config.name,
                            filename,
                            has_ckp: !config.ckp.is_empty(),
                            has_cmp1: config.cmp1.is_some(),
                            has_cmp2: config.cmp2.is_some(),
                        });
                    }
                }
            }
        }
    }
    
    // Sort by name
    signals.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(signals)
}

/// Load a signal by filename
pub fn load_signal(app: &AppHandle, filename: &str) -> Result<SignalConfig, SignalError> {
    let signals_dir = get_signals_dir(app)?;
    let filepath = signals_dir.join(filename);
    
    if !filepath.exists() {
        return Err(SignalError::NotFound(format!("Signal '{}' not found", filename)));
    }
    
    let content = fs::read_to_string(&filepath)?;
    let config: SignalConfig = serde_json::from_str(&content)?;
    
    Ok(config)
}

/// Delete a signal by filename
pub fn delete_signal(app: &AppHandle, filename: &str) -> Result<(), SignalError> {
    let signals_dir = get_signals_dir(app)?;
    let filepath = signals_dir.join(filename);
    
    if !filepath.exists() {
        return Err(SignalError::NotFound(format!("Signal '{}' not found", filename)));
    }
    
    fs::remove_file(&filepath)?;
    
    Ok(())
}

/// Format signal config as JSON string for ESP32
pub fn format_for_esp32(config: &SignalConfig) -> String {
    serde_json::to_string(config).unwrap_or_default()
}
