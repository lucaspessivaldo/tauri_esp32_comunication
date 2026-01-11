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
