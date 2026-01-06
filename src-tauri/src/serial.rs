use serde::{Deserialize, Serialize};
use serialport::{DataBits, FlowControl, Parity, SerialPort, StopBits};
use std::io::{Read, Write};
use std::sync::Mutex;
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
    #[error("Port not found: {0}")]
    PortNotFound(String),
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

    pub fn get_port_name(&self) -> Option<String> {
        self.port_name.clone()
    }

    pub fn send_command(&mut self, cmd: char) -> Result<String, SerialError> {
        let port = self.port.as_mut().ok_or(SerialError::NotConnected)?;

        // Send command
        port.write_all(&[cmd as u8])
            .map_err(|e| SerialError::WriteError(e.to_string()))?;
        port.flush()
            .map_err(|e| SerialError::WriteError(e.to_string()))?;

        // Small delay to allow ESP32 to respond
        std::thread::sleep(Duration::from_millis(100));

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

    pub fn send_config(&mut self, config: &str) -> Result<String, SerialError> {
        let port = self.port.as_mut().ok_or(SerialError::NotConnected)?;

        // Send config wrapped in markers
        let full_message = format!("<BEGIN>\n{}\n<END>\n", config);
        port.write_all(full_message.as_bytes())
            .map_err(|e| SerialError::WriteError(e.to_string()))?;
        port.flush()
            .map_err(|e| SerialError::WriteError(e.to_string()))?;

        // Wait for ESP32 to process
        std::thread::sleep(Duration::from_millis(500));

        // Read response
        let mut buffer = vec![0u8; 2048];
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
pub struct SerialState(pub Mutex<SerialConnection>);

impl Default for SerialState {
    fn default() -> Self {
        SerialState(Mutex::new(SerialConnection::new()))
    }
}
