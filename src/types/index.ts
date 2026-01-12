export interface PortInfo {
  name: string;
  port_type: string;
}

export interface DeviceStatus {
  connected: boolean;
  port_name: string | null;
  running: boolean;
  rpm: number;
  raw_response: string;
}

// Legacy edge format (for old config uploader)
export interface SignalEdge {
  angle: number;
  level: number;
}

export interface SignalConfig {
  edges: SignalEdge[];
}

export interface FullConfig {
  rpm: number;
  cycle: number;
  signals: {
    ckp: SignalConfig;
    cmp1: SignalConfig;
    cmp2: SignalConfig;
  };
}

// New device config format (from Signal Generator)
export interface DeviceSignalConfig {
  name: string;
  CKP: string;         // "SIG1..." encoded blob
  CMP1: string | null;
  CMP2: string | null;
}

// Signal info for listing (without full blob data)
export interface SignalInfo {
  name: string;
  filename: string;
  has_ckp: boolean;
  has_cmp1: boolean;
  has_cmp2: boolean;
}

// Upload result from ESP32
export interface UploadResult {
  success: boolean;
  bytes_sent: number;
  chunks_sent: number;
  raw_response: string;
  config_preview: string;
  error_message: string | null;
}

// Debug info for last upload attempt
export interface UploadDebugInfo {
  timestamp: Date;
  configJson: string;
  signalName: string;
  ckpBlob: string;       // First 100 chars of CKP blob
  cmp1Blob: string | null; // First 100 chars of CMP1 blob
  cmp2Blob: string | null; // First 100 chars of CMP2 blob
  ckpLength: number;
  cmp1Length: number | null;
  cmp2Length: number | null;
  totalBytes: number;
  result: UploadResult | null;
  preparationError: string | null;
  // Decoded blob info for debugging CRC issues
  ckpDecoded: DecodedBlobInfo | null;
  cmp1Decoded: DecodedBlobInfo | null;
  cmp2Decoded: DecodedBlobInfo | null;
}

// Decoded SIG1 blob info for debugging
export interface DecodedBlobInfo {
  seed: string;          // Hex representation
  edgeCount: number;
  storedCrc: string;     // Hex representation  
  calculatedCrc: string; // Hex representation
  crcMatch: boolean;
  firstEdges: string;    // First few edges as string
  allEdges: Array<{ angle: number; level: number }>; // All edges for full debug
  rawBytes: string;      // First 50 raw bytes as hex for debugging
}

// ============================================
// Signal Generator Types (for Signal Editor tab)
// ============================================

export interface Tooth {
  id: number;
  startAngle: number; // degrees
  endAngle: number; // degrees
  enabled: boolean;
}

export interface GearWheelConfig {
  id: string;
  name: string;
  totalTeeth: number;
  missingTeeth: number[];
  teeth: Tooth[];
  innerRadius: number;
  outerRadius: number;
}

export interface CKPConfig extends GearWheelConfig {
  pattern: string; // e.g., "60-2", "36-1"
}

export interface CMPConfig extends GearWheelConfig {
  segments: number;
}

export interface SignalPoint {
  angle: number;
  value: number;
}

export interface SignalData {
  ckp: SignalPoint[];
  cmp1: SignalPoint[];
  cmp2: SignalPoint[];
}

export type WheelPreset = {
  name: string;
  totalTeeth: number;
  missingTeeth: number[];
};

export const CKP_PRESETS: WheelPreset[] = [
  { name: "60-2", totalTeeth: 60, missingTeeth: [59, 60] },
  { name: "36-1", totalTeeth: 36, missingTeeth: [36] },
  { name: "36-2-2-2", totalTeeth: 36, missingTeeth: [9, 10, 18, 19, 27, 28] },
  { name: "12-1", totalTeeth: 12, missingTeeth: [12] },
  { name: "4-1", totalTeeth: 4, missingTeeth: [4] },
];

export const CMP_PRESETS: WheelPreset[] = [
  { name: "1", totalTeeth: 1, missingTeeth: [] },
  { name: "2", totalTeeth: 2, missingTeeth: [] },
  { name: "4", totalTeeth: 4, missingTeeth: [] },
  { name: "6", totalTeeth: 6, missingTeeth: [] },
  { name: "8", totalTeeth: 8, missingTeeth: [] },
];

// Export/Import configuration format
export interface ExportedConfig {
  version: number;
  CKP: string;    // Base64 encoded binary
  CMP1: string;   // Base64 encoded binary
  CMP2: string;   // Base64 encoded binary
  checksum: string;
}

// CKP editing mode
export type CKPMode = 'preset' | 'custom';

// Waveform display type for oscilloscope visualization
// 'square' - Hall/Digital sensor display (stepped square wave)
// 'sine' - Inductive sensor display (simulated sine wave with peaks at tooth edges)
export type WaveformDisplayType = 'square' | 'sine';

