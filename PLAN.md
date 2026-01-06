# Tauri ESP32 Communication App - Development Plan

## Overview

Desktop application using Tauri v2 that communicates with the ESP32 signal injector via USB Serial. Allows users to run/stop signals, adjust RPM, and update signal configurations in real-time.

## Architecture

```
tauri_esp32_comunication/
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   ├── main.rs            # Tauri entry point
│   │   ├── serial.rs          # Serial port handling
│   │   ├── protocol.rs        # Binary protocol encoding
│   │   └── commands.rs        # Tauri IPC commands
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                       # React + TypeScript frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── PortSelector.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── StatusDisplay.tsx
│   │   └── ConfigUploader.tsx
│   ├── hooks/
│   │   └── useSerial.ts
│   ├── store/
│   │   └── connectionStore.ts
│   └── types/
│       └── index.ts
├── package.json
└── PLAN.md
```

## ESP32 Communication Protocol

### Connection Parameters
| Parameter    | Value              |
|--------------|-------------------|
| Baud Rate    | 115200            |
| Data bits    | 8                 |
| Stop bits    | 1                 |
| Parity       | None              |
| Flow control | None              |
| USB Type     | CDC (Virtual COM) |

### ASCII Commands
| Command   | Function        | Details                    |
|-----------|-----------------|----------------------------|
| `r` / `R` | Run signal      | Starts signal generation   |
| `s` / `S` | Stop signal     | Sets all outputs LOW       |
| `+` / `=` | Increase RPM    | +100 RPM (max 5000)        |
| `-` / `_` | Decrease RPM    | -100 RPM (min 100)         |
| `?`       | Get status      | Returns current state info |
| `w` / `W` | Save to NVS     | Persists config to flash   |
| `d` / `D` | Reset defaults  | Clears NVS, resets config  |

### JSON Config Upload Format
```json
<BEGIN>
{
  "rpm": 2500,
  "cycle": 720,
  "signals": {
    "ckp":  { "edges": [{ "angle": 0, "level": 1 }, ...] },
    "cmp1": { "edges": [...] },
    "cmp2": { "edges": [...] }
  }
}
<END>
```

## Implementation Steps

### Step 1: Initialize Tauri v2 Project
```bash
cd /home/lucas/Codes/tauri_esp32_comunication
npm create tauri-app@latest . -- --template react-ts
npm install
npm install @tauri-apps/plugin-serialport
```

Add to `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-serialport = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Step 2: Create Rust Serial Module (`src-tauri/src/serial.rs`)
- `list_available_ports()` — enumerate COM/ttyUSB ports
- `connect(port: &str)` — open serial connection at 115200 baud
- `disconnect()` — close connection
- `send_command(cmd: char)` — send single-byte command
- `read_response()` — read and parse status response
- `upload_config(json: &str)` — send `<BEGIN>...<END>` wrapped config

### Step 3: Define Tauri IPC Commands (`src-tauri/src/commands.rs`)
```rust
#[tauri::command]
fn list_ports() -> Result<Vec<PortInfo>, String>

#[tauri::command]
fn connect(port: String) -> Result<(), String>

#[tauri::command]
fn disconnect() -> Result<(), String>

#[tauri::command]
fn run_signal() -> Result<(), String>

#[tauri::command]
fn stop_signal() -> Result<(), String>

#[tauri::command]
fn increase_rpm() -> Result<u16, String>

#[tauri::command]
fn decrease_rpm() -> Result<u16, String>

#[tauri::command]
fn set_rpm(rpm: u16) -> Result<(), String>

#[tauri::command]
fn get_status() -> Result<DeviceStatus, String>

#[tauri::command]
fn upload_config(config: String) -> Result<(), String>
```

### Step 4: Implement Protocol Encoder (`src-tauri/src/protocol.rs`)
- Port edge encoding from `signal_generator/src/utils/configCodec.ts`
- Convert wheel config to edge array format
- Angles stored as tenths of degree (0-7199)
- Wrap in JSON with `<BEGIN>` / `<END>` markers

### Step 5: Build React Frontend

**PortSelector.tsx** — Dropdown with available ports + connect/disconnect button

**ControlPanel.tsx** — Run/Stop toggle, RPM slider (100-5000), +/- buttons

**StatusDisplay.tsx** — Show connection state, current RPM, running status

**ConfigUploader.tsx** — File picker for JSON config, upload button, progress

**useSerial.ts hook:**
```typescript
const useSerial = () => {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  
  // Poll status every 500ms when connected
  // Expose: connect, disconnect, run, stop, setRpm, uploadConfig
};
```

### Step 6: Add Real-time Status Polling
- Poll `?` command every 500ms while connected
- Parse response: `RPM:xxxx STATE:RUN|STOP`
- Update UI state accordingly
- Handle disconnection gracefully

## UI Mockup

```
┌─────────────────────────────────────────────────────┐
│  CKP/CMP Signal Injector                        ─ □ x│
├─────────────────────────────────────────────────────┤
│  Port: [/dev/ttyUSB0      ▼]  [Connect]             │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Status: Connected ● Running                │   │
│   │  RPM: 2500                                  │   │
│   └─────────────────────────────────────────────────┘   │
│                                                     │
│   RPM: [━━━━━━━━━━●━━━━━━━━━━━━] 2500               │
│         100                   5000                  │
│                                                     │
│   [ ▶ RUN ]  [ ⏹ STOP ]  [ - ]  [ + ]              │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Signal Configuration                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ No config loaded                            │   │
│  └─────────────────────────────────────────────────┘   │
│  [Load Config File...]  [Upload to ESP32]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Dependencies

### Rust (Cargo.toml)
- `tauri` v2
- `tauri-plugin-serialport` v2
- `serde` + `serde_json`
- `tokio` (async runtime)

### Frontend (package.json)
- `@tauri-apps/api` v2
- `@tauri-apps/plugin-serialport`
- `react` + `react-dom`
- `zustand` (state management)
- `tailwindcss` (styling)

## Future Enhancements (v2)
- [ ] Embed signal editor (reuse signal_generator components)
- [ ] Signal visualization/oscilloscope view
- [ ] Multiple device support
- [ ] Firmware update via USB
- [ ] Config presets library
