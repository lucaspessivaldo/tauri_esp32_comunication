use serde::{Deserialize, Serialize};
use serialport::{DataBits, FlowControl, Parity, SerialPort, StopBits};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use thiserror::Error;

const BAUD_RATE: u32 = 115200;
const TIMEOUT_MS: u64 = 1000;

#[derive(Error, Debug)]
pub enum SerialError {
    #[error("No port connected")]
    NotConnected,
    #[error("Port already connected")]
    AlreadyConnected,
    #[error("Failed to open port: {0}")]
    OpenError(String),
    #[error("Failed to write to port: {0}")]
    WriteError(String),
    #[error("Failed to read from port: {0}")]
    ReadError(String),
}

impl Serialize for SerialError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct DeviceStatus {
    pub connected: bool,
    pub port_name: Option<String>,
    pub running: bool,
    pub rpm: u16,
    pub raw_response: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UploadResult {
    pub success: bool,
    pub bytes_sent: usize,
    pub chunks_sent: usize,
    pub raw_response: String,
    pub config_preview: String,
    pub error_message: Option<String>,
}

pub struct SerialConnection {
    port: Option<Box<dyn SerialPort>>,
    port_name: Option<String>,
}

impl SerialConnection {
    pub fn new() -> Self {
        SerialConnection {
            port: None,
            port_name: None,
        }
    }

    pub fn list_ports() -> Result<Vec<PortInfo>, SerialError> {
        let ports = serialport::available_ports()
            .map_err(|e| SerialError::OpenError(e.to_string()))?;

        Ok(ports
            .into_iter()
            .map(|p| {
                let port_type = match p.port_type {
                    serialport::SerialPortType::UsbPort(info) => {
                        format!(
                            "USB: {} {}",
                            info.manufacturer.unwrap_or_default(),
                            info.product.unwrap_or_default()
                        )
                    }
                    serialport::SerialPortType::BluetoothPort => "Bluetooth".to_string(),
                    serialport::SerialPortType::PciPort => "PCI".to_string(),
                    serialport::SerialPortType::Unknown => "Unknown".to_string(),
                };
                PortInfo {
                    name: p.port_name,
                    port_type,
                }
            })
            .collect())
    }

    pub fn connect(&mut self, port_name: &str) -> Result<(), SerialError> {
        if self.port.is_some() {
            return Err(SerialError::AlreadyConnected);
        }

        let port = serialport::new(port_name, BAUD_RATE)
            .data_bits(DataBits::Eight)
            .flow_control(FlowControl::None)
            .parity(Parity::None)
            .stop_bits(StopBits::One)
            .timeout(Duration::from_millis(TIMEOUT_MS))
            .open()
            .map_err(|e| SerialError::OpenError(e.to_string()))?;

        self.port = Some(port);
        self.port_name = Some(port_name.to_string());
        Ok(())
    }

    pub fn disconnect(&mut self) -> Result<(), SerialError> {
        if self.port.is_none() {
            return Err(SerialError::NotConnected);
        }
        self.port = None;
        self.port_name = None;
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.port.is_some()
    }

    pub fn send_command(&mut self, cmd: char) -> Result<String, SerialError> {
        let port = self.port.as_mut().ok_or(SerialError::NotConnected)?;

        // Send command
        port.write_all(&[cmd as u8])
            .map_err(|e| SerialError::WriteError(e.to_string()))?;
        port.flush()
            .map_err(|e| SerialError::WriteError(e.to_string()))?;

        // Small delay to allow ESP32 to respond (30ms is enough for simple commands)
        std::thread::sleep(Duration::from_millis(30));

        // Read response
        let mut buffer = vec![0u8; 1024];
        let mut response = String::new();

        loop {
            match port.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    response.push_str(&String::from_utf8_lossy(&buffer[..n]));
                }
                Ok(_) => break,
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => break,
                Err(e) => return Err(SerialError::ReadError(e.to_string())),
            }
        }

        Ok(response)
    }

    pub fn send_config(&mut self, config: &str) -> Result<UploadResult, SerialError> {
        let port = self.port.as_mut().ok_or(SerialError::NotConnected)?;

        // Create preview of config (first 200 chars)
        let config_preview: String = config.chars().take(500).collect();

        // Clear any pending input first
        let _ = port.clear(serialport::ClearBuffer::All);

        // Send config wrapped in <CFG>...<END> markers
        let full_message = format!("<CFG>\n{}\n<END>\n", config);
        let bytes_to_send = full_message.len();
        
        // Debug: log message size
        eprintln!("[SERIAL] Sending config: {} bytes", bytes_to_send);
        
        // Send in small chunks to avoid overwhelming ESP32 serial buffer (default 256 bytes)
        let bytes = full_message.as_bytes();
        let chunk_size = 64;
        let mut chunks_sent = 0;
        
        for chunk in bytes.chunks(chunk_size) {
            port.write_all(chunk)
                .map_err(|e| SerialError::WriteError(e.to_string()))?;
            port.flush()
                .map_err(|e| SerialError::WriteError(e.to_string()))?;
            chunks_sent += 1;
            // Small delay between chunks to let ESP32 buffer drain
            std::thread::sleep(Duration::from_millis(2));
        }

        // Wait for ESP32 to receive and process config
        let mut buffer = vec![0u8; 4096];
        let mut response = String::new();
        const RESPONSE_CAP: usize = 16 * 1024;
        let start = std::time::Instant::now();
        let max_wait = Duration::from_millis(15000); // 15 second max wait for large configs

        let mut saw_ack = false;
        let mut nak_line: Option<String> = None;

        let scan_for_ack_nak = |s: &str| {
            let mut ack = false;
            let mut nak: Option<String> = None;
            for line in s.lines() {
                let t = line.trim();
                if t == "ACK" {
                    ack = true;
                }
                if t.starts_with("NAK:") {
                    nak = Some(t.to_string());
                }
            }
            (ack, nak)
        };

        // Keep reading until we get ACK/NAK or timeout
        while start.elapsed() < max_wait {
            std::thread::sleep(Duration::from_millis(100));
            
            match port.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    response.push_str(&String::from_utf8_lossy(&buffer[..n]));

                    // Cap response to avoid unbounded growth
                    if response.len() > RESPONSE_CAP {
                        let keep_from = response.len() - RESPONSE_CAP;
                        response = response.split_off(keep_from);
                    }
                    
                    let (ack, nak) = scan_for_ack_nak(&response);
                    if ack {
                        saw_ack = true;
                    }
                    if nak.is_some() {
                        nak_line = nak;
                    }

                    // Check if we have a complete response (ACK or NAK)
                    if saw_ack || nak_line.is_some() {
                        break;
                    }
                }
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => return Err(SerialError::ReadError(e.to_string())),
            }
        }

        // If we saw ACK, drain briefly so trailing logs don't pollute the next command.
        if saw_ack {
            let drain_start = std::time::Instant::now();
            while drain_start.elapsed() < Duration::from_millis(250) {
                match port.read(&mut buffer) {
                    Ok(n) if n > 0 => {
                        response.push_str(&String::from_utf8_lossy(&buffer[..n]));
                        if response.len() > RESPONSE_CAP {
                            let keep_from = response.len() - RESPONSE_CAP;
                            response = response.split_off(keep_from);
                        }
                    }
                    Ok(_) => {}
                    Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => break,
                    Err(_) => break,
                }
                std::thread::sleep(Duration::from_millis(20));
            }
        }

        // Check for empty response (timeout without acknowledgment)
        if response.trim().is_empty() {
            return Ok(UploadResult {
                success: false,
                bytes_sent: bytes_to_send,
                chunks_sent,
                raw_response: response,
                config_preview,
                error_message: Some("No response from ESP32 - config may not have been applied (timeout)".to_string()),
            });
        }

        // Check for NAK (error) response first
        if let Some(line) = nak_line {
            return Ok(UploadResult {
                success: false,
                bytes_sent: bytes_to_send,
                chunks_sent,
                raw_response: response,
                config_preview,
                error_message: Some(line),
            });
        }

        // Verify ACK was received
        if !saw_ack {
            let preview: String = response.chars().take(300).collect();
            return Ok(UploadResult {
                success: false,
                bytes_sent: bytes_to_send,
                chunks_sent,
                raw_response: response,
                config_preview,
                error_message: Some(format!("No ACK received. Response preview: {}", preview)),
            });
        }

        Ok(UploadResult {
            success: true,
            bytes_sent: bytes_to_send,
            chunks_sent,
            raw_response: response,
            config_preview,
            error_message: None,
        })
    }

    pub fn get_status(&mut self) -> Result<DeviceStatus, SerialError> {
        if !self.is_connected() {
            return Ok(DeviceStatus {
                connected: false,
                ..Default::default()
            });
        }

        let response = self.send_command('?')?;

        // Parse response - format: "RPM:xxxx STATE:RUN|STOP"
        let mut status = DeviceStatus {
            connected: true,
            port_name: self.port_name.clone(),
            running: false,
            rpm: 0,
            raw_response: response.clone(),
        };

        // Simple parsing - adjust based on actual ESP32 response format
        for line in response.lines() {
            let line = line.trim();
            if line.contains("RPM") {
                if let Some(rpm_str) = line.split(':').nth(1) {
                    if let Ok(rpm) = rpm_str.trim().parse::<u16>() {
                        status.rpm = rpm;
                    }
                }
            }
            if line.contains("RUN") || line.contains("Running") {
                status.running = true;
            }
            if line.contains("STOP") || line.contains("Stopped") {
                status.running = false;
            }
        }

        Ok(status)
    }
}

// Thread-safe global connection
#[derive(Clone)]
pub struct SerialState(pub Arc<Mutex<SerialConnection>>);

impl Default for SerialState {
    fn default() -> Self {
        SerialState(Arc::new(Mutex::new(SerialConnection::new())))
    }
}
